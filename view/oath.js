let game = {}, action, appliedEffects, gameId, startOptions, rollbackConsent, over;

const setup = async () => {
    const seed = window.prompt("Please input a TTS seed or game ID");
    if (seed.length <= 3) {
        gameId = Number(seed);
        reload();
        return;
    }

    const response = await fetch("http://localhost:3000/oath/" + seed, { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });

    const info = await handleResponse(response);
    gameId = info.id;
    window.alert(`Created game ${gameId}`);
}

const pawnColors = { Purple: "💜", Red: "❤️", Blue: "💙", Yellow: "💛", White: "🤍", Black: "🖤" };
const warbandsColors = ["🟪", "🟥", "🟦", "🟨", "⬜", "⬛"];
const suitColors = { None: "🚫", Discord: "🔴", Arcane: "🟣", Order: "🔵", Hearth: "🟠", Beast: "🟤", Nomad: "🟢" };
const render = () => {
    const titleNode = document.getElementById("title");
    titleNode.innerHTML = game.name + " (Tale #" + game.chronicleNumber + "), Round " + game.round;

    const seedNode = document.getElementById("seed");
    seedNode.innerHTML = game.seed;


    const boardNode = document.getElementById("map");
    boardNode.innerHTML = "";
    for (const board of byType(game, "map")) {
        renderObject(boardNode, board);
    }


    const playersNode = document.getElementById("players");
    playersNode.innerHTML = "";
    const players = byType(game, "player");
    for (const index of game.order) {
        const player = players[index];
        if (player) renderObject(playersNode, player);
    }


    const infoNode = document.getElementById("info");
    infoNode.innerText = "[SUPPLY]";
    for (const obj of game.children) {
        if (obj._type === "player" || obj._type === "map") continue;
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
    if (!over) {
        if (action) {
            actionNode.innerText = "[" + action.message + "] (" + byType(game, "player").filter(e => e.id === action.player)[0]._name + ")";
            if (action.modifiers?.length) actionNode.appendChild(renderText("Modifiers: " + action.modifiers.join(", ")));
            for (const [k, select] of Object.entries(action.selects)) {
                const selectNode = actionNode.appendChild(renderText(select.name + ` (${select.min}-${select.max})`));
                selectNode.id = "select" + k;
                
                const selectList = selectNode.appendChild(document.createElement("ul"));
                for (const [i, choice] of select.choices.entries())
                    selectList.append(...renderCheckbox(k + i, choice, select.defaults.includes(choice)));
            }
            actionNode.appendChild(renderButton("Submit", () => continueAction()));
        } else {
            actionNode.innerText = "[Start action]";
            for (const name of startOptions)
                actionNode.appendChild(renderButton(name, () => startAction(name)));
        }
        actionNode.appendChild(renderButton("Cancel", () => cancelAction()));
        actionNode.appendChild(renderButton("Reload", () => reload()));
    } else {
        actionNode.innerText = "Game over!";
    }


    const rollbackNode = document.getElementById("rollback");
    rollbackNode.innerHTML = "";
    if (!over && rollbackConsent) {
        rollbackNode.innerText = "Rollback requires consent";
        for (const [color, consent] of Object.entries(rollbackConsent)) {
            if (consent) continue;
            rollbackNode.appendChild(renderButton(color, () => consentToRollback(color)));
        };
    }
}

const renderObject = (parent, obj) => {
    if (obj._hidden) return;

    let node, autoAppendChildren = true;
    switch (obj._type) {
        case "player":
            const board = byType(obj, "board")[0];
            if (board) {
                node = renderText(pawnColors[board.id] + (board.isCitizen ? "💜" : "") + " " + obj._name + " (" + board._name + ") (Supply: " + obj.supply + ")");
                node.innerText += (game._currentPlayer == obj.id ? " 🔄" : "");
                renderResourcesAndWarbands(node, board);
                break;
            }
        case "board":
            break;
        
        case "relic":
        case "worldCard":
        case "vision":
            node = renderCard(obj);
            break;
        
        case "site":
            node = renderCard(obj);
            node.innerText += " " + byType(game, "player").filter(e => e.site === obj.id).map(e => pawnColors[byType(e, "board")[0].id]).join("");
            break;
        
        case "favorBank":
            node = renderText(suitColors[obj.id] + ":");
            break;
        
        case "banner":
            node = renderText("🏳️ " + obj._name + ":");
            break;
                
        case "deck":
            node = renderDeck(obj, obj._name, obj.class === "Discard");
            autoAppendChildren = false;
            break;

        case "oath":
            node = renderText((game.isUsurper ? "🥇" : "🏅") + obj._name);
            break;
        
        case "resource":
        case "warband":
            break;
        
        default:
            node = renderText(obj._name);
    }

    if (!node) return;

    if (autoAppendChildren && obj.children) {
        renderResourcesAndWarbands(node, obj);
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
    if (card._type === "relic") cardNode.innerText += "🧰 ";
    if (card._type === "site") cardNode.innerText += "🗺️ ";
    cardNode.innerText += (card.facedown ? card._type === "vision" ? "👁️ " : "❔ " : "");
    cardNode.innerText += (card._locked ? "🔗" : "");
    cardNode.innerText += (!card.facedown || card.seenBy?.includes(game.order[game.turn]) ? (card._suit !== undefined ? suitColors[card._suit] + " " : "") + card._name : "");
    return cardNode;
}

const renderDeck = (deck, name, separateVisions = false) => {
    const deckNode = document.createElement("li");
    deckNode.id = name;
    deckNode.innerText = name + " (" + (deck.children?.length ?? 0) + ")";
    if (deck._searchCost !== undefined) deckNode.innerText += " : " + deck._searchCost + " Supply";
    if (!deck.children) return deckNode;

    let topCardVision = deck.children[0]?._type === "vision";
    const deckList = deckNode.appendChild(document.createElement("ul"));
    let facedownTotal = 0;
    for (const card of deck.children) {
        if (card.facedown && !card.seenBy?.includes(game.order[game.turn]) && !(separateVisions && card._type === "vision")) {
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

const renderResourcesAndWarbands = (node, obj) => {
    node.innerText += " " + byType(obj, "resource").sort((a, b) => a.class.localeCompare(b.class)).map(e => e.class === "Favor" ? "🟡" : e.flipped ? "📖" : "📘").join("");
    node.innerText += " " + byType(obj, "warband").map(e => warbandsColors[e.color]).join("");
}

const byType = (obj, type) => {
    return obj.children.filter(e => e._type === type);
}

const sortedChildren = (obj) => {
    return obj.children.sort((a, b) => b._type.localeCompare(a._type));
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

const renderCheckbox = (key, text, checked=false) => {
    const checkboxNode = document.createElement("input");
    checkboxNode.type = "checkbox";
    checkboxNode.id = "check" + key;
    checkboxNode.value = text;
    checkboxNode.checked = checked;
    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = "check" + key;
    checkboxLabel.innerText = text;
    return [checkboxNode, checkboxLabel];
}


const startAction = async (actionName) => {
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + game._currentPlayer + "/start/" + actionName, { 
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
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + (action?.player ?? game._currentPlayer) + "/cancel", { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
    handleResponse(response);
}

const consentToRollback = async (color) => {
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/" + color + "/consent", { 
        method: "POST", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
    handleResponse(response);
}

const reload = async () => {
    const response = await fetch("http://localhost:3000/oath/" + gameId + "/", { 
        method: "GET", 
        mode: "cors", 
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
    handleResponse(response);
}

const handleResponse = async (response) => {
    const info = await response.json();
    if (!response.ok) return window.alert(info.message);
    console.log(info);
    
    ({ game, action, appliedEffects, startOptions, rollbackConsent, over } = info);
    render();
}

setup();