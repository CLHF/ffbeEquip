var saveNeeded = false;

var saveTimeout;

var espers;
var ownedEspers;
var currentEsper;
var esperBoards;
var linkMode = false;

var gridContainer;

var sp;

var logged = false;

const maxLevelByStar = {
    "1": 30,
    "2": 40,
    "3": 60
}

const maxStatLevelByStar = {
    "1": 30,
    "2": 40,
    "3": 100
}

function beforeShow() {
    $("#pleaseWaitMessage").addClass("hidden");
    $("#esper").removeClass("hidden");
    $(".nav-tabs li").removeClass("active");
}

function show(esperName) {
    beforeShow();
    currentEsper = esperName;
    var escapedName = escapeName(esperName);
    $(".nav-tabs li." + escapedName).addClass("active");
    var esper;
    for (var index in espers) {
        if (espers[index].name == esperName) {
            esper = espers[index];
            break;
        }
    }
    if (esper) {
        var optionsHtml = "";
        if (logged) {
            optionsHtml += '<option value="notOwned">Not owned</option>';
        }
        for (var i = 1; i <= esper.maxLevel; i++) {
            optionsHtml += '<option value="' + i + '">' + i + ' ★</option>';
        }
        $("#esper #esperStar").html(optionsHtml);
        if (ownedEspers[esperName]) {
            $("#esper #esperStar option[value=" + ownedEspers[esperName].rarity + "]").prop('selected', true);
            setEsperLevel(ownedEspers[esperName].level);
            showBoard(esper.name, ownedEspers[esperName].rarity);
            $("#esper .levelLine").removeClass("hidden");
            $("#esper .spLine").removeClass("hidden");
            $(".stats").removeClass("invisible");
            $(".esperOtherStats").removeClass("invisible");
            $("#esperResist").html(getResistHtml(ownedEspers[currentEsper]));
            $("#esperSkills").html(getKillersHtml(ownedEspers[currentEsper]));
        } else {
            $("#esper .levelLine").addClass("hidden");
            $("#esper .spLine").addClass("hidden");
            $(".stats").addClass("invisible");
            $(".esperOtherStats").addClass("invisible");
            gridContainer.addClass("hidden");
        }
    }
}
function showBoard(esperName, star) {
    var nodes = $("#grid li .hexagon");
    nodes.removeClass("hp mp atk def mag spr ability resist killer selected");
    $(".line").remove();
    
    var grid = $("#grid");
    grid.removeClass("star1 star2 star3");
    gridContainer.removeClass("hidden");
    
    var escapedName = escapeName(esperName);
    $("#grid li.0_0 .hexagon").html('<img class="esperCenterIcon" src=\"img/' + escapedName +'.png\"/>');
    $("#grid").addClass("star" + star);
    var board = esperBoards[esperName];
    var rootNode = $("#grid li.0_0 .hexagon");
    rootNode.addClass("selected");
    for (var index in board.nodes) {
        showNode(board.nodes[index], rootNode, star);
    }
}

function setEsperLevel(level) {
    $("#level").val(level);
    ownedEspers[currentEsper].level = level;
    updateSp();
    updateStats();
}
    
function updateSp() {
    var level = parseInt($("#level").val());
    var star = parseInt($("#esperStar").val());
    var board = esperBoards[currentEsper];
    sp = [];
    var availableSP = 0;
    for (var i = 1; i < star; i++) {
        var progression = board.progression[i.toString()];
        for (var j = 0; j < progression.length; j++) {
            availableSP += progression[j];
        }
    }
    var progression = board.progression[star];
    for (var j = 0; j < level; j++) {
        availableSP += progression[j];
    }
    
    var board = esperBoards[currentEsper];
    var usedSp = 0;
    for (var index in board.nodes) {
        usedSp += calculateUsedSp(board.nodes[index]);
    }
    
    sp[0] = usedSp;
    sp[1] = availableSP;
    $("#sp").text(usedSp + " / " +availableSP);
    if (usedSp > availableSP) {
        $("#sp").addClass("error");
    } else {
        $("#sp").removeClass("error");
    }
}

function updateStats() {
    var level = parseInt($("#level").val());
    var star = parseInt($("#esperStar").val());
    var board = esperBoards[currentEsper];
    var ownedEsper = ownedEspers[currentEsper];
    
    for (var index = 0; index < baseStats.length; index++) {
        var minStat = board.stats[star][baseStats[index].toUpperCase()][0];
        var maxStat = board.stats[star][baseStats[index].toUpperCase()][1];
        ownedEsper[baseStats[index]] = minStat + (maxStat - minStat) / maxStatLevelByStar[star] * level;
    }
    
    for (var index in board.nodes) {
        addStatsOfSelectedNodes(board.nodes[index], ownedEsper);
    }
    
    for (var index = 0; index < baseStats.length; index++) {
        var statBonusCoef = 1;
        if (ownedEsper.esperStatsBonus && ownedEsper.esperStatsBonus[baseStats[index]]) {
            statBonusCoef += ownedEsper.esperStatsBonus[baseStats[index]] / 100;
        }
        $("#esper_" + baseStats[index]).html(ownedEsper[baseStats[index]] + "&nbsp;(+" + Math.floor(ownedEsper[baseStats[index]] * statBonusCoef / 100) + ")");
    }
}

function addStatsOfSelectedNodes(node, ownedEsper) {
    var posString = getPositionString(node.position[0], node.position[1]);
    if (ownedEspers[currentEsper].selectedSkills.includes(posString)) {
        for (var index = 0; index < baseStats.length; index++) {
            if (node[baseStats[index]]) {
                ownedEsper[baseStats[index]] += node[baseStats[index]];
            }
        }
        for (var index = 0; index < node.children.length; index++) {
            addStatsOfSelectedNodes(node.children[index], ownedEsper);
        }
    }
}

function calculateUsedSp(node) {
    var cost = 0;
    var posString = getPositionString(node.position[0], node.position[1]);
    if (ownedEspers[currentEsper].selectedSkills.includes(posString)) {
        cost += node.cost;
        for(var i = 0; i < node.children.length; i++) {
            cost += calculateUsedSp(node.children[i]);
        }
    }
    return cost;
}

function getCenterX(node) {
    var offset = node.offset();
    var width = node.width();
    return offset.left - gridContainer.offset().left + width / 2;
}

function getCenterY(node) {
    var offset = node.offset();
    var height = node.height();
    return offset.top - gridContainer.offset().top + height / 2;
}

function showNode(node, parentNodeHtml, star) {
    var posString = getPositionString(node.position[0], node.position[1]);
    var nodeHtml = $("#grid li." + posString + " .hexagon");
    for (var statIndex = 0; statIndex < baseStats.length; statIndex++) {
        if (node[baseStats[statIndex]]) {
            nodeHtml.html('<span class="iconHolder"></span><span class="text">' + baseStats[statIndex].toUpperCase() + ' + ' + node[baseStats[statIndex]] + '</span><span class="cost">' + node.cost + ' SP</span>');
            nodeHtml.addClass(baseStats[statIndex]);
            break;
        }
        if (node[percentValues[baseStats[statIndex]]]) {
            nodeHtml.html('<span class="iconHolder"><img class="icon" src="/img/items/ability_77.png"></img></span><span class="text">' + baseStats[statIndex].toUpperCase() + ' + ' + node[percentValues[baseStats[statIndex]]] + '%</span><span class="cost">' + node.cost + ' SP</span>');
            nodeHtml.addClass(baseStats[statIndex]);
            break;
        }
    }
    if (node.special) {
        var indexOfBracket = node.special[0].indexOf("[");
        var indexOfSemicolon = node.special[0].indexOf(":");
        var ability = node.special[0].substr(indexOfBracket,indexOfSemicolon);
        nodeHtml.html('<span class="iconHolder">' + abilityIcon(ability) + '</span><span class="text">' + abilityName(ability) + '</span><span class="cost">' + node.cost + ' SP</span>');
        nodeHtml.addClass("ability");
    }
    if (node.resist) {
        nodeHtml.html('<span class="iconHolder"></span><span class="text">' + getResistHtml(node) + '</span><span class="cost">' + node.cost + ' SP</span>');
        nodeHtml.addClass("resist");
    }
    if (node.killers) {
        var killer = node.killers[0];
        var html = '<span class="iconHolder">';
        if (killer.physical) {
            html+= '<img class="miniIcon physical" src="img/sword.png">';
        }
        if (killer.magical) {
            html+= '<img class="miniIcon magical" src="img/rod.png">';
        }
        html += '<img class="icon" src="/img/items/ability_79.png"></img></span><span class="text"><span class="capitalize">' + killer.name + '</span> ';
        if (killer.physical) {
            html+= killer.physical + '%';
        } else {
            html+= killer.magical + '%';
        }
        html+='</span><span class="cost">' + node.cost + ' SP</span>';
        nodeHtml.html(html);
        nodeHtml.addClass("killer");
    }
    if (node.esperStatsBonus) {
        var html = '<span class="iconHolder"><img class="icon" src="/img/items/ability_77.png"></img></span><span class="text">ST Reflection Boost<a href="http://exvius.gamepedia.com/ST_Reflection_Boost" target="_blank"><span class="glyphicon glyphicon-new-window wikiLink"></span></a></span><span class="cost">' + node.cost+ ' SP</span>';
        nodeHtml.html(html);
        nodeHtml.addClass("ability");
    }
    if (node.lbPerTurn) {
        var html = '<span class="iconHolder"><img class="icon" src="/img/items/ability_91.png"></img></span><span class="text">+' + node.lbPerTurn.min + ' LS/turn<a href="http://exvius.gamepedia.com/Auto-Limit" target="_blank"><span class="glyphicon glyphicon-new-window wikiLink"></span></a></span><span class="cost">' + node.cost+ ' SP</span>';
        nodeHtml.html(html);
        nodeHtml.addClass("ability");
    }
    if (ownedEspers[currentEsper].selectedSkills.includes(posString)) {
        nodeHtml.addClass("selected");
    }
    if (distance(node.position[0], node.position[1]) <= star + 1) {
        gridContainer.line(getCenterX(parentNodeHtml), getCenterY(parentNodeHtml), getCenterX(nodeHtml), getCenterY(nodeHtml));
    }
    for (var i= 0; i < node.children.length; i++) {
        showNode(node.children[i], nodeHtml, star);
    }
}

function abilityIcon(text) {
    return text.replace(/(\[[^\]]*\])/g, function(v) {
        var vWithoutBrace = v.substring(1, v.length - 1);
        var token = vWithoutBrace.split("|");
        var result = "";
        if (token.length >= 2) {
            result += "<img class='icon' src='/img/items/" + token[token.length - 1] + "'></img>"
        }
        return result;
    });
};

function abilityName(text) {
    return text.replace(/(\[[^\]]*\])/g, function(v) {
        var vWithoutBrace = v.substring(1, v.length - 1);
        var token = vWithoutBrace.split("|");
        if (token.length == 3) {
            return toLink(token[1], token[0]);
        } else {
            return toLink(token[0]);    
        }
    });
}

function prepareSave() {
    if (logged) {
        saveNeeded = true;
        if (saveTimeout) {clearTimeout(saveTimeout)}
        saveTimeout = setTimeout(saveUserData,3000, false, false, true);
        $(".saveInventory").removeClass("hidden");
    }
}

function selectNode(x,y) {
    var posString = getPositionString(x, y);
    var path = findPathTo(x,y,esperBoards[currentEsper]);
    if (ownedEspers[currentEsper].selectedSkills.includes(posString)) {
        var node = path[path.length - 1];
        unselectNodeAndChildren(node);
    } else {
        if (path) {
            for (var index = 0; index < path.length; index++) {
                var posString = getPositionString(path[index].position[0], path[index].position[1]);
                if (!ownedEspers[currentEsper].selectedSkills.includes(posString)) {
                    ownedEspers[currentEsper].selectedSkills.push(posString);
                    addNodeStatToEsper(ownedEspers[currentEsper], path[index]);
                    $("#grid li." + posString + " .hexagon").addClass("selected");
                }
            }
        }
    }
    updateSp();
    updateStats();
    $("#esperResist").html(getResistHtml(ownedEspers[currentEsper]));
    $("#esperSkills").html(getKillersHtml(ownedEspers[currentEsper]));
    prepareSave();
}

function addNodeStatToEsper(esper, node) {
    if (node.killers) {
        addKillers(esper, node.killers);
    }
    if (node.resist) {
        addElementalResist(esper, node.resist);
    }
    if (node.esperStatsBonus) {
        addEsperStatsBonus(esper, node.esperStatsBonus);
    }
    if (node.lbPerTurn) {
        esper.lbPerTurn = node.lbPerTurn;
    }
    for (var i = baseStats.length; i--;) {
        if (node[percentValues[baseStats[i]]]) {
            addToStat(esper, percentValues[baseStats[i]], node[percentValues[baseStats[i]]]);
        }
    }
}

function unselectNodeAndChildren(node) {
    var posString = getPositionString(node.position[0], node.position[1]);
    var index = ownedEspers[currentEsper].selectedSkills.indexOf(posString)
    if (index >= 0) {
        ownedEspers[currentEsper].selectedSkills.splice(index, 1);
        $("#grid li." + posString + " .hexagon").removeClass("selected");
        if (node.killers) {
            removeKillers(ownedEspers[currentEsper], node.killers);
        }
        if (node.resist) {
            removeElementalResist(ownedEspers[currentEsper], node.resist);
        }
        if (node.esperStatsBonus) {
            removeEsperStatsBonus(ownedEspers[currentEsper], node.esperStatsBonus);
        }
        for (var i = baseStats.length; i--;) {
            if (node[percentValues[baseStats[i]]]) {
                removeFromStat(ownedEspers[currentEsper], percentValues[baseStats[i]], node[percentValues[baseStats[i]]]);
            }
        }
        for (var i = 0; i < node.children.length; i++) {
            unselectNodeAndChildren(node.children[i]);
        }
    }
}


function addKillers(esper, killers) {
    for (var i = 0; i < killers.length; i++) {
        addKiller(esper, killers[i].name, killers[i].physical, killers[i].magical);
    }
}
function addKiller(skill, race, physicalPercent, magicalPercent) {
    if (!skill.killers) {
        skill.killers = [];
    }
    var killerData;
    for (var index in skill.killers) {
        if (skill.killers[index].name == race) {
            killerData = skill.killers[index];
            break;
        }
    }
    
    if (!killerData) {
        killerData = {"name":race};
        skill.killers.push(killerData);
    }
    if (physicalPercent != 0) {
        if (killerData.physical) {
            killerData.physical += physicalPercent;
        } else {
            killerData.physical = physicalPercent;
        }
    }
    if (magicalPercent != 0) {
        if (killerData.magical) {
            killerData.magical += magicalPercent;
        } else {
            killerData.magical = magicalPercent;
        }
    }
}
function removeKillers(esper, killers) {
    for (var i = 0; i < killers.length; i++) {
        for (var index in esper.killers) {
            if (esper.killers[index].name == killers[i].name) {
                if (killers[i].physical) {
                    esper.killers[index].physical -= killers[i].physical;
                    if (esper.killers[index].physical == 0) {
                        delete esper.killers[index].physical
                    }
                }
                if (killers[i].magical) {
                    esper.killers[index].magical -= killers[i].magical;
                    if (esper.killers[index].magical == 0) {
                        delete esper.killers[index].magical
                    }
                }
                if (!esper.killers[index].physical && !esper.killers[index].magical) {
                    esper.killers.splice(index, 1);
                }
                break;
            }
        }
    }
    if (esper.killers.length == 0) {
        delete esper.killers;
    }
}


function addElementalResist(item, resist) {
    for (var i = 0; i < resist.length; i++) {
        if (!item.resist) {
            item.resist = [];
        }
        var existingResist;
        for (var j = 0; j < item.resist.length; j++) {
            if (item.resist[j].name == resist[i].name) {
                existingResist = item.resist[j];
                break;
            }
        }
        if (!existingResist) {
            item.resist.push(JSON.parse(JSON.stringify(resist[i])));
        } else {
            existingResist.percent += resist[i].percent;
        }
    }
}
function removeElementalResist(item, resist) {
    for (var i = 0; i < resist.length; i++) {
        for (var j = 0; j < item.resist.length; j++) {
            if (item.resist[j].name == resist[i].name) {
                item.resist[j].percent -= resist[i].percent;
                if (item.resist[j].percent == 0) {
                    item.resist.splice(j,1);
                }
                break;
            }
        }
    }
    if (item.resist.length == 0) {
        delete item.resist;
    }
}

function addEsperStatsBonus(item, bonus) {
    if (!item.esperStatsBonus) {
        item.esperStatsBonus = {"hp":0, "mp":0, "atk":0, "def":0, "mag":0, "spr":0};
    }
    for (var i = 0; i < baseStats.length; i++) {
        item.esperStatsBonus[baseStats[i]] += bonus[baseStats[i]];
    }
}
function removeEsperStatsBonus(item, bonus) {
    for (var i = 0; i < baseStats.length; i++) {
        item.esperStatsBonus[baseStats[i]] -= bonus[baseStats[i]];
    }
    if (item.esperStatsBonus.hp == 0 && item.esperStatsBonus.mp == 0 && item.esperStatsBonus.atk == 0 && item.esperStatsBonus.def == 0 && item.esperStatsBonus.mag == 0 && item.esperStatsBonus.spr == 0) {
        delete item.esperStatsBonus;
    }
}

function addToStat(esper, stat, value) {
    if (!esper[stat]) {
        esper[stat] = 0;
    }
    esper[stat] += value;
}
function removeFromStat(esper, stat, value) {
    esper[stat] -= value;
    if (esper[stat] == 0) {
        delete esper[stat];
    }
}

function onMouseOverNode(x,y) {
    var path = findPathTo(x,y,esperBoards[currentEsper]);
    if (path) {
        for (var index = 0; index < path.length; index++) {
            var posString = getPositionString(path[index].position[0], path[index].position[1]);
            $("#grid li." + posString + " .hexagon").addClass("hover");
        }
    }
}

function onMouseOutNode() {
    $("#grid .hexagon.hover").removeClass("hover");
}

function findPathTo(x,y, fromNode, currentPath = []) {
    if (fromNode.nodes) {
        for (var index = 0; index < fromNode.nodes.length; index++) {
            var path = findPathTo(x, y, fromNode.nodes[index], currentPath);
            if (path) {
                return path;
            }
        }   
    } else {
        currentPath = currentPath.concat(fromNode);
        if (fromNode.position && fromNode.position[0] == x && fromNode.position[1] == y) {
            return currentPath;
        }
        if (fromNode.children.length == 0) {
            return null;
        }
        for (var index = 0; index < fromNode.children.length; index++) {
            var path = findPathTo(x, y, fromNode.children[index], currentPath);
            if (path) {
                return path;
            }
        }
        return null;
    }
}

function displayEspers() {
    if (!logged && !linkMode) {
        ownedEspers = {};
        for (var index in espers) {
            ownedEspers[espers[index].name] = {
                "name":espers[index].name, 
                "id":espers[index].id, 
                "rarity":espers[index].maxLevel,
                "level": maxLevelByStar[espers[index].maxLevel],
                "selectedSkills":[], 
                "resist":JSON.parse(JSON.stringify(esperBoards[espers[index].name].resist[espers[index].maxLevel]))};
        }
    }
    if (linkMode) {
        // init esper from link mode
        
        var esperName = Object.keys(ownedEspers)[0];
        ownedEspers[esperName].resist = JSON.parse(JSON.stringify(esperBoards[esperName].resist[ownedEspers[esperName].rarity]));
        for (var i = 0, len = ownedEspers[esperName].selectedSkills.length; i < len; i++) {
            var pos = getPositionFromString(ownedEspers[esperName].selectedSkills[i]);
            var path = findPathTo(pos.x,pos.y,esperBoards[esperName]);
            if (path) {
                addNodeStatToEsper(ownedEspers[esperName], path[path.length - 1]);
            }
        }
    }
    
    if (!linkMode) {
        var tabs = "";
        for (var index = 0; index < espers.length; index++) {
            var escapedName = escapeName(espers[index].name);
            tabs += "<li class=\"" + escapedName + "\" onclick=\"show('" + espers[index].name + "')\"><a><img src=\"img/" + escapedName +".png\"/></a></li>";
        }
        $("#espers #tabs").html(tabs);
    }
    var boardHtml = "";
    for (var i = 0; i < 81; i++) {
        var y = Math.trunc(i/9) - 4;
        var x = i % 9 - 4;
        x = x + Math.round(y/2)
        var posString = getPositionString(x, y);
        boardHtml += '<li class="' + posString + '"><div class="hexagon ';
        var dist = distance(x, y);
        if (dist > 4) {
            boardHtml += " notUsed ";
        } else if (dist > 3) {
            boardHtml += " star3 ";
        } else if (dist > 2) {
            boardHtml += " star2 ";
        } else {
            boardHtml += " star1 ";
        }
        boardHtml += ' " onclick="selectNode(' + x + ',' + y + ')" onmouseover="onMouseOverNode(' + x + ',' + y + ')" onmouseout="onMouseOutNode()"></div></li>';
    }
    $("#grid").html(boardHtml);
    
    $("#espers").removeClass("hidden");
    $("#pleaseWaitMessage").addClass("hidden");
    $("#loginMessage").addClass("hidden");
    if (!logged && !linkMode) {
        $("#notLoginWarningMessage").removeClass("hidden");
    }
    
    if (linkMode) {
        show(Object.keys(ownedEspers)[0]);
    } else {
        show(espers[0].name);
    }
    
}

function distance(x1, y1) {
    return (Math.abs(x1) + Math.abs(x1 - y1) + Math.abs(y1)) / 2;
}

function getPositionString(x, y) {
    var posString = "";
    if (x < 0) {
        posString += "m" + -x;
    } else {
        posString += x;
    }
    posString += "_"
    if (y < 0) {
        posString += "m" + -y;
    } else {
        posString += y;
    }
    return posString;
}

function getPositionFromString(posString) {
    var result = {};
    var tokens = posString.split("_");
    if (tokens[0].startsWith("m")) {
        result.x = - Number.parseInt(tokens[0].substr(1));
    } else {
        result.x = Number.parseInt(tokens[0]);
    }
    if (tokens[1].startsWith("m")) {
        result.y = - Number.parseInt(tokens[1].substr(1));
    } else {
        result.y = Number.parseInt(tokens[1]);
    }
    return result;
}

function notLoaded() {
    if (window.location.hash.length > 1) {
        var hashValue = window.location.hash.substr(1);
        ownedEspers = JSON.parse(atob(hashValue));
        
        $('.navbar').addClass("hidden");
        linkMode = true;
    } else {
        ownedEspers = {};    
    }
    
    if (esperBoards) {
        displayEspers();
    }
    $("#pleaseWaitMessage").addClass("hidden");
    $("#loginMessage").removeClass("hidden");
    $("#inventory").addClass("hidden");
}

function inventoryLoaded() {
    logged = true;
    if (esperBoards) {
        displayEspers();
    }
}

function onLevelChange() {
    var star = $("#esperStar").val();
    var level = parseInt($("#level").val());
    if (level > maxLevelByStar[star]) {
        setEsperLevel(maxLevelByStar[value]);
    } else {
        setEsperLevel(level);
    }
    prepareSave();
}

function getPublicEsperLink() {
    var esperToExport = {};
    esperToExport[currentEsper] = {
        "name":ownedEspers[currentEsper].name,
        "rarity":ownedEspers[currentEsper].rarity,
        "level":ownedEspers[currentEsper].level,
        "selectedSkills":ownedEspers[currentEsper].selectedSkills,
    };
    
    $('<div id="showLinkDialog" title="Esper Link">' + 
        '<input value="http://ffbeEquip.com/espers.html?server=' + server + '&o#' + btoa(JSON.stringify(esperToExport)) + '"></input>' +
        '<h4>This link will allow to visualize this esper build</h4>' +
        '</div>' ).dialog({
        modal: true,
        open: function(event, ui) {
            $(this).parent().css('position', 'fixed');
            $("#showLinkDialog input").select();
            try {
                var successful = document.execCommand('copy');
                if (successful) {
                    $("#showLinkDialog input").after("<div>Link copied to clipboard<div>");
                } else {
                    console.log('Oops, unable to copy');    
                }
            } catch (err) {
                console.log('Oops, unable to copy');
            }
        },
        position: { my: 'top', at: 'top+150' },
        width: 600
    });
}


// will be called by common.js at page load
function startPage() {
    gridContainer = $("#gridContainer");
    if (window.location.hash.length > 1) {
        $("#pleaseWaitMessage").addClass("hidden");
        $("#loginMessage").addClass("hidden");
    }
	// Ajax calls to get the item and units data, then populate unit select, read the url hash and run the first update
    getStaticData("espers", false, function(result) {
        espers = result;
        getStaticData("esperBoards", false, function(result) {
            esperBoards = result;
            if (ownedEspers) {
                displayEspers();
            }
        });
    });


    $("#results").addClass(server);
    

    $(window).on("beforeunload", function () {
        if  (saveNeeded) {
            return "Unsaved change exists !"
        }
    });
    $("#esper #esperStar").change(function () {
        var value = $("#esper #esperStar").val();
        if (value == "notOwned") {
            $("#esper .levelLine").addClass("hidden");
            $("#esper .spLine").addClass("hidden");
            delete ownedEspers[currentEsper];
            gridContainer.addClass("hidden");
            $(".stats").addClass("invisible");
            $(".esperOtherStats").addClass("invisible");
        } else {
            $("#esper .levelLine").removeClass("hidden");
            $("#esper .spLine").removeClass("hidden");
            ownedEspers[currentEsper] = {"name":currentEsper, "id":currentEsper, "rarity":parseInt(value),"selectedSkills":[]};
            ownedEspers[currentEsper].resist = JSON.parse(JSON.stringify(esperBoards[currentEsper].resist[value]));
            $("#esperResist").html(getResistHtml(ownedEspers[currentEsper]));
            $("#esperSkills").html(getKillersHtml(ownedEspers[currentEsper]));
            setEsperLevel(maxLevelByStar[value]);
            showBoard(currentEsper, parseInt(value));
            $(".stats").removeClass("invisible");
            $(".esperOtherStats").removeClass("invisible");
        }
        prepareSave();
    });
    $("#esper #level").on("input", $.debounce(300,onLevelChange));
}
