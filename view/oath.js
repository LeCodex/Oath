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
const warbandsColors = ["🟪", "🟥", "🟦", "🟨", "⬜", "⬛"];
const suitColors = ["🚫", "🔴", "🟣", "🔵", "🟠", "🟤", "🟢"];
const render = () => {
    const titleNode = document.getElementById("title");
    titleNode.innerHTML = game.name + " (Tale #" + game.chronicleNumber + "), Round " + game.round;

    const seedNode = document.getElementById("seed");
    seedNode.innerHTML = game.seed;


    const boardNode = document.getElementById("board");
    boardNode.innerHTML = "";
    for (const board of byType(game, "board")) {
        renderObject(boardNode, board);
    }


    const playersNode = document.getElementById("players");
    playersNode.innerHTML = "";
    for (const player of byType(game, "player")) {
        renderObject(playersNode, player);
    }


    const infoNode = document.getElementById("info");
    infoNode.innerText = "[SUPPLY]";
    for (const obj of game.children) {
        if (obj.type === "player" || obj.type === "board") continue;
        renderObject(infoNode, obj);
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
        actionNode.innerText = "[" + action.message + "] (" + byType(game, "player")[action.player].name + ")";
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

const renderObject = (parent, obj) => {
    if (obj.hidden) return;

    let node, autoAppendChildren = true;
    switch (obj.type) {
        case "player":
            node = renderText(obj.name + " (Supply: " + obj.supply + ")" + (obj.isCitizen ? " 💜" : "") + (game.currentPlayer == obj.id ? " 🔄" : ""));
            break;
        
        case "board":
            node = renderText("[BOARD]");
            break;
        case "region":
            node = renderText(obj.name);
            break;
        
        case "relic":
        case "worldCard":
        case "vision":
            node = renderCard(obj);
            break;
        
        case "site":
            node = renderCard(obj);
            node.innerText += " " + byType(game, "player").filter(e => e.site == obj.id).map(e => pawnColors[e.id]).join("");
            break;
        
        case "favorBank":
            node = renderText(suitColors[obj.id + 1] + ":");
            break;
        
        case "banner":
            node = renderText(obj.name + ":");
            break;
                
        case "deck":
            node = renderDeck(obj, obj.name, obj.class === "Discard");
            autoAppendChildren = false;
            break;
        
        case "bag":
            if (obj.children.length) node = renderText("Bag:")
            break;
        case "reliquary":
            node = renderText("Reliquary:");
            break;
        case "reliquarySlot":
            node = renderText(obj.name);
            break;
        case "visionSlot":
            if (obj.children.length) node = renderText("Vision:")
            break;

        case "oath":
            node = renderText("Oath of " + oathNames[obj.id] + (game.isUsurper ? " 🥇" : " 🏅"));
            break;
        
        case "resource":
        case "warband":
            break;
        
        default:
            node = renderText(`UNHANDLED ${obj.type} (${obj.id})`);
    }

    if (!node) return;

    if (autoAppendChildren) {
        node.innerText += " " + byType(obj, "resource").map(e => e.class === "Favor" ? "🟡" : e.flipped ? "📖" : "📘").join("");
        node.innerText += " " + byType(obj, "warband").map(e => warbandsColors[e.color]).join("");
        const list = node.appendChild(document.createElement("ul"));
        for (const child of sortedChildren(obj)) {
            renderObject(list, child);
        }
    }

    parent.appendChild(node);
}

const renderCard = (card) => {
    const cardNode = document.createElement("li");
    cardNode.id = "card" + card.id;
    cardNode.innerText = (card.facedown ? card.type === "vision" ? "👁️ " : "❔ " : "")
    cardNode.innerText += (!card.facedown || card.seenBy.includes(game.order[game.turn]) ? (card.suit !== undefined ? suitColors[card.suit+1] + " " : "") + card.name : "");
    return cardNode;
}

const renderDeck = (deck, name, separateVisions = false) => {
    const deckNode = document.createElement("li");
    deckNode.id = name;
    deckNode.innerText = name + " (" + deck.children.length + ")";
    if (deck.searchCost) deckNode.innerText += " : " + deck.searchCost + " Supply";

    let topCardVision = deck.children[0]?.type === "vision";
    const deckList = deckNode.appendChild(document.createElement("ul"));
    let facedownTotal = 0;
    for (const card of deck.children) {
        if (card.facedown && !card.seenBy.includes(game.order[game.turn]) && !(separateVisions && card.type === "vision")) {
            facedownTotal++;
        } else {
            if (facedownTotal) deckList.appendChild(renderText(facedownTotal + (topCardVision ? " 👁️" : " ❔")));
            facedownTotal = 0;
            topCardVision = false;
            renderObject(deckList, card);
        }
    }
    if (facedownTotal) deckList.appendChild(renderText(facedownTotal + (topCardVision ? " 👁️" : " ❔")));

    return deckNode;
}

const byType = (obj, type) => {
    return obj.children.filter(e => e.type === type);
}

const sortedChildren = (obj) => {
    return obj.children.sort((a, b) => b.type.localeCompare(a.type));
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