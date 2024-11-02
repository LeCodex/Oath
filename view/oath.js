let game = {};
let action = undefined;
let appliedEffects = undefined;
let gameId = undefined;
let startOptions = undefined;

const setup = async () => {
    const seed = window.prompt("Please input a TTS seed");
    const response = await fetch("http://localhost:3000/oath/" + seed, { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });

    const info = await handleResponse(response);
    gameId = info.id;
    window.alert(`Created game ${gameId}`);
}

const oathNames = ["Supremacy", "the People", "Devotion", "Protection"];
const visionNames = ["Conquest", "Revolution", "Faith", "Sanctuary"];
const pawnColors = ["💜", "❤️", "💙", "💛", "🤍", "🖤"];
const suitColors = ["🚫", "🔴", "🟣", "🔵", "🟠", "🟤", "🟢"];
const resourceNames = ["🟡", "📘", "📖"];
const render = () => {
    const titleNode = document.getElementById("title");
    titleNode.innerHTML = game.name + " (Tale #" + game.chronicleNumber + "), an Oath of " + oathNames[game.oath] + ", Round " + game.round;

    const seedNode = document.getElementById("seed");
    seedNode.innerHTML = game.seed;

    const infoNode = document.getElementById("info");
    infoNode.innerHTML = "";
    infoNode.appendChild(renderText("[BANNERS]"));
    for (const [i, banner] of Object.entries(game.banners)) {
        const bannerNode = infoNode.appendChild(renderText(banner.name + ": " + resourceNames[banner.type].repeat(banner.amount)));
        bannerNode.id = "bank" + i;
    }

    const banksNode = infoNode.appendChild(renderText("[BANKS]"));
    const banksList = banksNode.appendChild(document.createElement("ul"));
    for (const [i, bank] of Object.entries(game.favorBanks)) {
        const bankNode = banksList.appendChild(renderText(suitColors[Number(i)+1] + ": " + "🟡".repeat(bank.amount)));
        bankNode.id = "bank" + i;
    }

    infoNode.appendChild(renderText("[DECKS]"));
    infoNode.appendChild(renderDeck(game.relicDeck, "Relic Deck"));
    infoNode.appendChild(renderDeck(game.worldDeck, "World Deck"));

    const boardNode = document.getElementById("board");
    boardNode.innerHTML = "";
    for (const [i, region] of Object.entries(game.board.children)) {
        const regionNode = boardNode.appendChild(renderText(region.name));
        regionNode.id = "region" + i;

        const regionList = regionNode.appendChild(document.createElement("ul"));
        for (const site of region.sites) {
            const siteNode = regionList.appendChild(renderCard(site));
            siteNode.innerText +=  " " + Object.entries(game.players).filter(([_, v]) => v.site == site.name).map(([k, _]) => pawnColors[k]).join("");

            const siteList = siteNode.appendChild(document.createElement("ul"));
            for (const denizen of site.denizens) siteList.appendChild(renderCard(denizen));
            for (const relic of site.relics) siteList.appendChild(renderCard(relic));
        }

        infoNode.appendChild(renderDeck(region.discard, region.name + " Discard", true));
    }


    const playersNode = document.getElementById("players");
    playersNode.innerHTML = "";
    for (const [i, player] of Object.entries(game.players)) {
        const playerNode = playersNode.appendChild(renderText(player.name + (player.isCitizen ? " 💜" : "") + (game.turn == i ? " 🔄" : "") + (game.oathkeeper == i ? game.isUsurper ? " 🥇" : " 🏅": "")));
        playerNode.id = "player" + i;

        const playerList = playerNode.appendChild(document.createElement("ul"));
        // playerList.appendChild(renderText("At " + player.site));
        playerList.appendChild(renderText("Supply: " + player.supply + " / Bag: " + player.warbandsInBag));
        playerList.appendChild(renderText("Resources: " + getResourcesAndWarbandsText(player)));
        if (player.vision) playerList.appendChild(renderText(player.vision.name));

        const thingsNode = playerList.appendChild(renderText("Things:"));
        thingsNode.id = "playerThings" + i;
        
        const thingsList = thingsNode.appendChild(document.createElement("ul"));
        for (const adviser of player.advisers) thingsList.appendChild(renderCard(adviser));
        for (const relic of player.relics) thingsList.appendChild(renderCard(relic));
        for (const banner of player.banners) thingsList.appendChild(renderText(banner));

        if (player.reliquary) {
            const reliquaryNode = playerList.appendChild(renderText("Reliquary:"));
            reliquaryNode.id = "reliquary";
            
            const reliquaryList = reliquaryNode.appendChild(document.createElement("ul"));
            for (const relic of player.reliquary.relics) reliquaryList.appendChild(relic ? renderCard(relic) : renderText("Empty"));
        }
    }


    const effectsNode = document.getElementById("effects");
    effectsNode.innerHTML = "";
    if (appliedEffects) {
        for (const [i, effect] of appliedEffects.entries()) {
            const effectNode = effectsNode.appendChild(renderText(effect.effect));
            effectNode.id = "effect" + i;

            const effectsList = effectNode.appendChild(document.createElement("ul"));
            for (const [key, value] of Object.entries(effect))
                if (key !== "effect")
                    effectsList.appendChild(renderText(`${key}: ${value}`));
        }
    }


    const actionNode = document.getElementById("action");
    actionNode.innerHTML = "";
    if (action) {
        actionNode.innerText = "[" + action.message + "] (" + game.players[action.player].name + ")";
        if (action.modifiers?.length) actionNode.appendChild(renderText("Modifiers: " + action.modifiers.join(", ")));
        for (const [k, select] of Object.entries(action.selects)) {
            const selectNode = actionNode.appendChild(renderText(select.name + ` (${select.min}-${select.max})`));
            selectNode.id = "select" + k;
            
            const selectList = selectNode.appendChild(document.createElement("ul"));
            for (const [i, choice] of select.choices.entries())
                selectList.append(...renderCheckbox(k + i, choice));
        }
        actionNode.appendChild(renderButton("Submit", () => continueAction()));
    } else {
        actionNode.innerText = "[Start action]";
        for (const name of startOptions)
            actionNode.appendChild(renderButton(name, () => startAction(name)));
    }
    actionNode.appendChild(renderButton("Cancel", () => cancelAction()));
}

const renderCard = (card) => {
    const cardNode = document.createElement("li");
    cardNode.id = "card" + card.name;
    cardNode.innerText = (card.facedown ? card.visionBack ? "👁️ " : "❔ " : "")
    cardNode.innerText += (!card.facedown || card.seenBy.includes(game.order[game.turn]) ? (card.suit !== undefined ? suitColors[card.suit+1] + " " : "") + card.name : "") + " " + getResourcesAndWarbandsText(card);
    return cardNode;
}

const renderDeck = (deck, name, separateVisions = false) => {
    const deckNode = document.createElement("li");
    deckNode.id = name;
    deckNode.innerText = name + " (" + deck.cards.length + ")";
    if (deck.searchCost) deckNode.innerText += " : " + deck.searchCost + " Supply";

    let topCardVision = deck.cards[0]?.visionBack;
    const deckList = deckNode.appendChild(document.createElement("ul"));
    let facedownTotal = 0;
    for (const card of deck.cards) {
        if (card.facedown && !card.seenBy.includes(game.order[game.turn]) && !(separateVisions && card.visionBack)) {
            facedownTotal++;
        } else {
            if (facedownTotal) deckList.appendChild(renderText(facedownTotal + (topCardVision ? " 👁️" : " ❔")));
            facedownTotal = 0;
            topCardVision = false;
            deckList.appendChild(renderCard(card));
        }
    }
    if (facedownTotal) deckList.appendChild(renderText(facedownTotal + (topCardVision ? " 👁️" : " ❔")));

    return deckNode;
}

const byType = (thing, type) => {
    return thing.children.filter(e => e.type === type);
}

const warbandsColors = ["🟪", "🟥", "🟦", "🟨", "⬜", "⬛"];
const getResourcesAndWarbandsText = (thing) => {
    let text = "";
    text += byType(thing, "Favor").map(e => "🟡").join("");
    text += byType(thing, "Favor").map(e => e.flipped ? "📘" : "📖").join("");
    text += " ";
    text += byType(thing, "OathWarband").map(e => warbandsColors[e.id]).join("");
    return text;
}

const renderText = (text) => {
    const textNode = document.createElement("li");
    textNode.innerText = text;
    return textNode;
}

const renderButton = (text, callback) => {
    const parentNode = document.createElement("li");
    const buttonNode = parentNode.appendChild(document.createElement("button"));
    buttonNode.innerText = text;
    buttonNode.onclick = callback;
    return parentNode;
}

const renderCheckbox = (key, text) => {
    const checkboxNode = document.createElement("input");
    checkboxNode.type = "checkbox";
    checkboxNode.id = "check" + key;
    checkboxNode.value = text;
    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = "check" + key;
    checkboxLabel.innerText = text;
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
    if (!response.ok) return window.alert(info.message);
    console.log(info);
    
    game = info.game;
    action = info.activeAction;
    appliedEffects = info.appliedEffects;
    startOptions = info.startOptions;
    render();
    return info;
}

setup();