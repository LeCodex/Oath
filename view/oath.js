let game = {};
let action = undefined;
let gameId = undefined;

const setup = async () => {
    const response = await fetch("http://localhost:3000/oath", { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' } 
    });

    game = await response.json();
    gameId = game.id;
    window.alert(`Created game ${game.id}`);
    render();
}

const oathNames = ["Supremacy", "Protection", "the People", "Devotion"];
const suitColors = ["🔴", "🟣", "🔵", "🟠", "🟤", "🟢"];
const resourceNames = ["🟡", "📘", "📗"];
const render = () => {
    const infoNode = document.getElementById("info");
    infoNode.innerHTML = "";
    infoNode.appendChild(renderText("[BANNERS]"));
    for (const [i, banner] of Object.entries(game.banners)) {
        const bannerNode = infoNode.appendChild(document.createElement("li"));
        bannerNode.id = "bank" + i;
        bannerNode.innerText = banner.name + ": " + resourceNames[banner.type].repeat(banner.amount);
    }

    const banksNode = infoNode.appendChild(renderText("[BANKS]"));
    const banksList = banksNode.appendChild(document.createElement("ul"));
    for (const [i, bank] of Object.entries(game.favorBanks)) {
        const bankNode = banksList.appendChild(document.createElement("li"));
        bankNode.id = "bank" + i
        bankNode.innerText = suitColors[i] + ": " + "🟡".repeat(bank.amount);
    }

    infoNode.appendChild(renderText("[DECKS]"));
    const worldDeckNode = infoNode.appendChild(document.createElement("li"));
    worldDeckNode.id = "worldDeck";
    worldDeckNode.innerText = "World Deck (" + game.worldDeck.cards.length + ", " + game.worldDeck.searchCost + ")";
    const relicdDeckNode = infoNode.appendChild(document.createElement("li"));
    relicdDeckNode.id = "relicDeck";
    relicdDeckNode.innerText = "Relic Deck (" + game.relicDeck.cards.length + ")";


    const boardNode = document.getElementById("board");
    boardNode.innerHTML = "";
    boardNode.appendChild(renderText("Oath of " + oathNames[game.oath] + ", Round " + game.round));
    for (const [i, region] of Object.entries(game.board.regions)) {
        const regionNode = boardNode.appendChild(document.createElement("li"));
        regionNode.id = "region" + i;
        regionNode.innerText = region.name;

        const regionList = regionNode.appendChild(document.createElement("ul"));
        for (const site of region.sites) {
            const siteNode = regionList.appendChild(renderCard(site));

            const siteList = siteNode.appendChild(document.createElement("ul"));
            for (const denizen of site.denizens) siteList.appendChild(renderCard(denizen));
            for (const relic of site.relics) siteList.appendChild(renderCard(relic));
        }

        const discardNode = infoNode.appendChild(document.createElement("li"));
        discardNode.id = "discard" + i;
        discardNode.innerText = region.name + " Discard (" + region.discard.cards.length + ", " + region.discard.searchCost + ")";
    }


    const playersNode = document.getElementById("players");
    playersNode.innerHTML = "";
    for (const [i, player] of Object.entries(game.players)) {
        const playerNode = playersNode.appendChild(document.createElement("li"));
        playerNode.id = "player" + i;
        playerNode.innerText = player.name + (game.turn == i ? " 🔄" : "") + (game.oathkeeper == i ? game.isUsurper ? " 🥇" : " 🏅": "");

        const playerList = playerNode.appendChild(document.createElement("ul"));
        playerList.appendChild(renderText("At " + player.site));
        playerList.appendChild(renderText("Supply: " + player.supply));
        playerList.appendChild(renderText("Bag: " + player.warbandsInBag));
        playerList.appendChild(renderText("Resources: " + getResourcesAndWarbandsText(player)));

        const thingsNode = playerList.appendChild(document.createElement("li"));
        thingsNode.id = "playerThings" + i;
        thingsNode.innerText = "Things:";
        
        const thingsList = thingsNode.appendChild(document.createElement("ul"));
        for (const adviser of player.advisers) thingsList.appendChild(renderCard(adviser));
        for (const relic of player.relics) thingsList.appendChild(renderCard(relic));
        for (const banner of player.banners) thingsList.appendChild(renderText(banner));

        if (player.reliquary) {
            const reliquaryNode = playerList.appendChild(document.createElement("li"));
            reliquaryNode.id = "reliquary";
            reliquaryNode.innerText = "Reliquary:";
            
            const reliquaryList = reliquaryNode.appendChild(document.createElement("ul"));
            for (const relic of player.reliquary.relics) reliquaryList.appendChild(relic ? renderCard(relic) : renderText("Empty"));
        }
    }


    const actionNode = document.getElementById("action");
    actionNode.innerHTML = "";
    if (action) {
        actionNode.innerText = "[" + action.message + "]";
        if (action.modifiers?.length) actionNode.appendChild(renderText("Modifiers: " + action.modifiers.join(", ")));
        for (const [k, select] of Object.entries(action.selects)) {
            const selectNode = actionNode.appendChild(document.createElement("li"));
            selectNode.id = "select" + k;
            selectNode.innerText = "Choose " + select.min + "-" + select.max;
            
            const selectList = selectNode.appendChild(document.createElement("ul"));
            for (const [i, choice] of select.choices.entries()) {
                selectList.append(...renderCheckbox(k + i, choice))
            }
        }
        actionNode.appendChild(renderButton("Submit", () => continueAction()));
    } else {
        actionNode.innerText = "[Start action]";
        actionNode.appendChild(renderText("[MAJOR]"));
        actionNode.appendChild(renderButton("Muster", () => startAction("muster")));
        actionNode.appendChild(renderButton("Trade", () => startAction("trade")));
        actionNode.appendChild(renderButton("Travel", () => startAction("travel")));
        actionNode.appendChild(renderButton("Recover", () => startAction("recover")));
        actionNode.appendChild(renderButton("Search", () => startAction("search")));
        actionNode.appendChild(renderButton("Campaign", () => startAction("campaign")));
        actionNode.appendChild(renderText("[MINOR]"));
        actionNode.appendChild(renderButton("Use", () => startAction("use")));
        actionNode.appendChild(renderButton("Rest", () => startAction("rest")));
    }
    actionNode.appendChild(renderButton("Cancel", () => cancelAction()));
}

const renderCard = (card) => {
    const cardNode = document.createElement("li");
    cardNode.id = "card" + card.name;
    cardNode.innerText = card.facedown && !card.seenBy.includes(game.order[game.turn]) ? "???" : (card.suit !== undefined ? suitColors[card.suit] + " " : "") + card.name  + " " + getResourcesAndWarbandsText(card);
    return cardNode;
}

const playerColors = ["🟪", "🟥", "🟦", "🟨", "⬜", "⬛"]
const getResourcesAndWarbandsText = (thing) => {
    let text = "";
    text += Object.entries(thing.resources).filter(([_, v]) => v > 0).map(([k, v]) => resourceNames[k].repeat(v)).join("");
    text += " ";
    text += Object.entries(thing.warbands).filter(([_, v]) => v > 0).map(([k, v]) => playerColors[k].repeat(v)).join("");
    return text;
}

const renderText = (text) => {
    const textNode = document.createElement("li");
    textNode.innerText = text;
    return textNode;
}

const renderButton = (text, callback) => {
    const buttonNode = document.createElement("button");
    buttonNode.innerText = text;
    buttonNode.onclick = callback;
    return buttonNode;
}

const renderCheckbox = (key, text) => {
    const checkboxNode = document.createElement("input");
    checkboxNode.type = "checkbox";
    checkboxNode.id = "check" + key;
    checkboxNode.value = text;
    const checkboxLabel = document.createElement("label");
    checkboxLabel.innerText = text;
    checkboxLabel.for = "check" + key;
    return [checkboxNode, checkboxLabel];
}


const startAction = async (actionName) => {
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + game.turn + "/start/" + actionName, { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
    handleResponse(response);
}

const continueAction = async () => {
    let body = {};
    for (const [k, select] of Object.entries(action.selects)) {
        body[k] = [];
        const selectNode = document.getElementById("select" + k);
        for (const input of selectNode.childNodes[1].childNodes)
            if (input.checked) body[k].push(input.value);
    }

    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + action.player + "/continue", { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    handleResponse(response);
}

const cancelAction = async () => {
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + game.turn + "/cancel", { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
    handleResponse(response);
}

const handleResponse = async (response) => {
    const info = await response.json();
    if (!response.ok) return window.alert(JSON.stringify(info));
    console.log(info);
    
    game = info.game;
    action = info.activeAction;
    render();
}

setup();