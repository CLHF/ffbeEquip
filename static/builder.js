var inventory = {"byType":{},"byCondition":{}};
var numberByType = {}

var rawData;
var data = {};
var dataWithCondition = [];
var dualWieldSources = [];
var espers;
var selectedEspers = [];
var units;
var itemOwned;
var onlyUseOwnedItems = true;
var selectedUnit;

var equipable;

var ennemyResist = {"fire":0,"ice":0,"water":0,"wind":0,"lightning":0,"earth":0,"light":-50,"dark":0};
var ennemyRaces;
var innateElements = [];

var bestValue = 0;
var bestBuild;
var bestEsper;

var statToMaximize = "atk";

var stats = [];
var numberOfItemCombination;

var currentBuildCombinationIndex = 0;

var fixedItems = [
    null, 
    null, 
    null, 
    null, 
    null, 
    null, 
    null, 
    null,
    null,
    null]

function build() {
    bestValue = 0;
    bestBuild = null;
    
    if (!itemInventory) {
        alert("Please log in to load your inventory");
        return;
    }
    if (Object.keys(itemInventory).length == 0) {
        alert("Your inventory is empty. Please go to the Search tab to fill your inventory");
        return;
    }
    
    var selectedUnitName = $("#unitsSelect").val();
    if (!selectedUnitName) {
        alert("Please select an unit");
        return;
    }
    selectedUnit = units[selectedUnitName];
    
    readEnnemyResists();
    ennemyRaces = getSelectedValuesFor("races");
    innateElements = getSelectedValuesFor("elements");
    
    prepareData(selectedUnit.equip);
    prepareEquipable();
    selectEspers();
    optimize();
}

function prepareEquipable() {
    equipable = [[],[],[],[],["accessory"],["accessory"],["materia"],["materia"],["materia"],["materia"]];
    for (var equipIndex in selectedUnit.equip) {
        if (weaponList.includes(selectedUnit.equip[equipIndex])) {
            equipable[0].push(selectedUnit.equip[equipIndex]);
        } else if (shieldList.includes(selectedUnit.equip[equipIndex])) {
            equipable[1].push(selectedUnit.equip[equipIndex]);
        } else if (headList.includes(selectedUnit.equip[equipIndex])) {
            equipable[2].push(selectedUnit.equip[equipIndex]);
        } else if (bodyList.includes(selectedUnit.equip[equipIndex])) {
            equipable[3].push(selectedUnit.equip[equipIndex]);
        } 
    }
    if (hasInnateDualWield()) {
        equipable[1] = equipable[1].concat(equipable[0]);
    }
}

function prepareData(equipable) {
    data = {};
    dataWithCondition = [];
    dualWieldSources = [];
    var tempData = {};
    for (var index in rawData) {
        var item = rawData[index];
        if (getOwnedNumber(item) > 0 && isApplicable(item) && (equipable.includes(item.type) || item.type == "accessory" || item.type == "materia")) {
            if (item.equipedConditions) {
                dataWithCondition.push(item);
            } else {
                if (item.dualWield) {
                    dualWieldSources.push(item);
                }
                if (!data[item.type]) {
                    data[item.type] = [];
                }
                var statValue = calculateMaxValue(item);
                var itemEntry = {"value":statValue, "item":item, "name":item.name};
                data[item.type].push(itemEntry);
            }
        }
    }
    for (var typeIndex in typeList) {
        var type = typeList[typeIndex];
        if (data[type]) {
            data[type].sort(function (entry1, entry2) {
                return entry2.value - entry1.value;
            });
        } else {
            data[type] = [];  
        }
    }
}

function selectEspers() {
    selectedEspers = [];
    var maxValueEsper = null;
    for (var index in espers) {
        if (maxValueEsper == null || espers[index][statToMaximize] > maxValueEsper.atk) {
            maxValueEsper = espers[index];
        }
        if (getKillerCoef(espers[index]) > 0) {
            selectedEspers.push(espers[index]);
        }
    }
    if (!selectedEspers.includes(maxValueEsper)) {
        selectedEspers.push(maxValueEsper);
    }
}

function getKillerCoef(item) {
    var cumulatedKiller = 0;
    if (ennemyRaces.length > 0 && item.killers) {
        for (var killerIndex in item.killers) {
            if (ennemyRaces.includes(item.killers[killerIndex].name)) {
                cumulatedKiller += item.killers[killerIndex].physical;
            }
        }
    }
    return cumulatedKiller / ennemyRaces.length;
}

function readEnnemyResists() {
    for(var element in ennemyResist) {
        var value = $("#elementalResists td." + element + " input").val();
        if (value) {
            ennemyResist[element] = parseInt(value);
        } else {
            ennemyResist[element] = 0;
        }
    }
}

function readEnnemyRaces() {
    for(var element in ennemyResist) {
        var value = $("#elementalResists td." + element + " input").val();
        if (value) {
            ennemyResist[element] = parseInt(value);
        } else {
            ennemyResist[element] = 0;
        }
    }
}




function optimize() {
    $("#buildProgressBar .progress").removeClass("finished");
    var combinations = [];
    typeCombination = [null, null, null, null, null, null, null, null, null, null];
    buildTypeCombination(0,typeCombination, combinations);
    
    
    if (!hasInnateDualWield() && dualWieldSources.length > 0) {
        equipable[1] = equipable[1].concat(equipable[0]);
        for (var index in dualWieldSources) {
            var item = dualWieldSources[index];
            if (item.dualWield == "all") {
                var slot = 0;
                if (item.type == "accessory") {
                    slot = 4;
                } else if (item.type == "materia") {
                    slot = 6;
                }
                fixedItems[slot] = item;
                buildTypeCombination(0,typeCombination,combinations);
                fixedItems[slot] = null;
            }
        }
    }
    console.log(combinations.length);
    
    console.log("cores : " + navigator.hardwareConcurrency);
    currentBuildCombinationIndex = 0;
    for (var i = 0; i < navigator.hardwareConcurrency; i++) {
        if (currentBuildCombinationIndex < combinations.length) {
            var worker = new Worker('calculateBestBuild.js');
            worker.onmessage = function(e) {
                console.log("result job " + index + " - " + e.data.bestValue);
                if (e.data.bestValue > bestValue) {
                    bestBuild = e.data.bestBuild;
                    bestValue = e.data.bestValue;
                    bestEsper = e.data.bestEsper;
                    logBuild(bestBuild, bestEsper);
                }
                var progress = Math.floor((e.data.index + 1)/combinations.length*100) + "%";
                var progressElement = $("#buildProgressBar .progress");
                progressElement.width(progress);
                progressElement.text(progress);
                if (currentBuildCombinationIndex < combinations.length) {
                    console.log("Starting job " + currentBuildCombinationIndex);
                    worker.postMessage(["calculateBuild",combinations[currentBuildCombinationIndex].combination, combinations[currentBuildCombinationIndex].data, combinations[currentBuildCombinationIndex].fixed, currentBuildCombinationIndex]);
                    currentBuildCombinationIndex++;
                }
            }
            worker.postMessage(["init",selectedEspers, itemInventory, statToMaximize, selectedUnit, ennemyRaces, ennemyResist, innateElements]);
            console.log("Starting job " + currentBuildCombinationIndex);
            worker.postMessage(["calculateBuild",combinations[currentBuildCombinationIndex].combination, combinations[currentBuildCombinationIndex].data, combinations[currentBuildCombinationIndex].fixed, currentBuildCombinationIndex]);
            currentBuildCombinationIndex++;
        }
    }
    
    //findBestBuildForCombinationAsync(0, combinations);
}

function buildTypeCombination(index, typeCombination, combinations) {
    if (fixedItems[index]) {
        tryType(index, typeCombination, fixedItems[index].type, combinations);
    } else {
        if (equipable[index].length > 0) {
            var found = false;
            for (var typeIndex in equipable[index]) {
                type = equipable[index][typeIndex]
                if (index == 1 && alreadyTriedInSlot0(type, typeCombination[0], equipable[0])) {
                    continue;
                }
                if (data[type].length > 0) {
                    tryType(index, typeCombination, type, combinations);
                    found = true;
                }
            }
            if (!found) {
                typeCombination[index] = null;
                buildTypeCombination(index+1, typeCombination, combinations);
            }
        } else {
            typeCombination[index] = null;
            buildTypeCombination(index+1, typeCombination, combinations);
        }
    }
}

function tryType(index, typeCombination, type, combinations) {
    typeCombination[index] = type;
    if (index == 9) {
        build = [null, null, null, null, null, null, null, null, null, null];
        numberOfItemCombination = 0;
        var dataWithdConditionItems = {}
        for (var slotIndex = 0; slotIndex < 10; slotIndex++) {
            if (typeCombination[slotIndex]) {
                dataWithdConditionItems[typeCombination[slotIndex]] = addConditionItems(data[typeCombination[slotIndex]], typeCombination[slotIndex], typeCombination);
            }
        }
        combinations.push({"combination":typeCombination.slice(), "data":dataWithdConditionItems, "fixed":fixedItems.slice()});
    } else {
        buildTypeCombination(index+1, typeCombination, combinations);
    }
}

function alreadyTriedInSlot0(type, typeSlot0, equipableSlot0) {
    if (type == typeSlot0) {
        return false;
    }
    var indexOfTypeSlot0 = equipableSlot0.indexOf(typeSlot0);
    if (indexOfTypeSlot0 >= 0) {
        for (var index = 0; index <= indexOfTypeSlot0; index++) {
            if (equipableSlot0[index] == type) {
                return true;
            }
        }
    }
    return false;
}

function logDataWithdConditionItems(dataWithdConditionItems) {
    for (var index in dataWithdConditionItems) {
        logAddConditionItems(dataWithdConditionItems[index]);
    }
}

function findBestBuildForCombinationAsync(index, combinations) {
    var build = [null, null, null, null, null, null, null, null, null, null];
    findBestBuildForCombination(0, build, combinations[index].combination, combinations[index].data, combinations[index].fixed);
    //console.log(Math.floor(index/combinations.length*100) + "%" );
    var progress = Math.floor((index + 1)/combinations.length*100) + "%";
    var progressElement = $("#buildProgressBar .progress");
    progressElement.width(progress);
    progressElement.text(progress);
    if (index + 1 < combinations.length) {
        setTimeout(findBestBuildForCombinationAsync,0,index+1,combinations);
    } else {
        logBuild(bestBuild, bestEsper);
        progressElement.addClass("finished");
    }
}

function findBestBuildForCombination(index, build, typeCombination, dataWithConditionItems, fixedItems) {
    
}


function addConditionItems(itemsOfType, type, typeCombination) {
    var tempResult = itemsOfType.slice();
    for (var index in dataWithCondition) {
        var item = dataWithCondition[index];
        if (item.type == type) {
            var allFound = true;
            for (var conditionIndex in item.equipedConditions) {
                if (!typeCombination.includes(item.equipedConditions[conditionIndex])) {
                    allFound = false;
                    break;
                }
            }
            if (allFound) {
                tempResult.push({"value":calculateMaxValue(item), "item":item, "name":item.name});
            }
        }
    }
    tempResult.sort(function (entry1, entry2) {
        
        if (entry1.value == entry2.value2) {
            return getOwnedNumber(entry2.item) - getOwnedNumber(entry1.item);
        } else {
            return entry2.value - entry1.value;
        }
    });
    var numberNeeded = 0;
    for (var slotIndex in typeCombination) {
        if (typeCombination[slotIndex] == type) {
            numberNeeded++;
        }
    }
    var number = 0;
    var itemIndex = 0;
    var itemKeptNames = [];
    var damageCoefLevelAlreadyKept = {};
    while(itemIndex < tempResult.length) {
        item = tempResult[itemIndex].item;
        if (number < numberNeeded) {
            if (!itemKeptNames.includes(item.name)) {
                if (!isStackable(item)) {
                    number += 1;
                } else {
                    number += getOwnedNumber(item);
                }
            }
            var damageCoefLevel = getDamageCoefLevel(item);
            if (damageCoefLevelAlreadyKept[damageCoefLevel]) {
                damageCoefLevelAlreadyKept[damageCoefLevel] = 0;
            }
            damageCoefLevelAlreadyKept[damageCoefLevel] += damageCoefLevel;
            itemIndex++;
        } else {
            var damageCoefLevel = getDamageCoefLevel(item);
            if (damageCoefLevel == "" || (damageCoefLevelAlreadyKept[damageCoefLevel] && damageCoefLevelAlreadyKept[damageCoefLevel] >= numberNeeded)) {
                tempResult.splice(itemIndex, 1);
            } else {
                if (damageCoefLevelAlreadyKept[damageCoefLevel]) {
                    damageCoefLevelAlreadyKept[damageCoefLevel] = 0;
                }
                damageCoefLevelAlreadyKept[damageCoefLevel] += damageCoefLevel;
                itemIndex++;
            }
        }
    }
    var result = [];
    for (var index in tempResult) {
        result.push(tempResult[index].item);
    }
    return result;
}

function getDamageCoefLevel(item) {
    var damageCoefLevel = "";
    var killerCoef = getKillerCoef(item);
    if (killerCoef > 0) {
        damageCoefLevel += "killer" + killerCoef;
    }
    if ((item.element && ennemyResist[item.element] < 0)) {
        damageCoefLevel += "element" + ennemyResist[item.element];
    }
    if (damageCoefLevel == "" && weaponList.includes(item.type) && (!item.element || innateElements.includes(item.element))) {
        damageCoefLevel = "elementless";
    }
    return damageCoefLevel;
}

function logAddConditionItems(data) {
    var string = "";
    for (var index in data) {
        string += data[index].name + ", ";
    }
    console.log(string);
}




function isStackable(item) {
    return !(item.special && item.special.includes("notStackable"));
}

function isTwoHanded(item) {
    return (item.special && item.special.includes("twoHanded"));
}

function hasInnateDualWield() {
    for (var index in selectedUnit.skills) {
        if (selectedUnit.skills[index].dualWield && selectedUnit.skills[index].dualWield == "all") {
            return true;
        }
    }
    return false;
}

function getOwnedNumber(item) {
    if (onlyUseOwnedItems) {
        if (itemInventory[item.name]) {
            return itemInventory[item.name];
        } else {
            return 0;
        }
    } else {
        return 4;
    }
}


function isApplicable(item) {
    if (item.exclusiveSex && item.exclusiveSex != selectedUnit.sex) {
        return false;
    }
    if (item.exclusiveUnits && !item.exclusiveUnits.includes(selectedUnit.name)) {
        return false;
    }
    return true;
}

function calculateMaxValue(item) {
    var baseValue = selectedUnit.stats.maxStats[statToMaximize] + selectedUnit.stats.pots[statToMaximize];
    var calculatedValue = 0;
    if (item[statToMaximize]) {
        calculatedValue += item[statToMaximize];
    }
    if (item[statToMaximize + '%']) {
        calculatedValue += item[statToMaximize+'%'] * baseValue / 100;
    }
    return calculatedValue;
}



function logBuild(build, esper) {
    var order = [0,1,2,3,4,5,6,7,8,9];
    var html = "";
    for (var index = 0; index < order.length; index++) {
        var item = build[order[index]];
        if (item) {
            html += '<div class="tr">';
            html += displayItemLine(item);
            html += "</div>";
        }
    }
    $("#results .tbody").html(html);
    $("#resultStats").html(statToMaximize + " = " + "TODO" + ' , damage (on 100 def) = ' + Math.floor(bestValue / 100) + ". esper : " + esper.name);
}



// Populate the unit html select with a line per unit
function populateUnitSelect() {
    var options = '<option value=""></option>';
    Object.keys(units).sort().forEach(function(value, index) {
        options += '<option value="'+ value + '">' + value + '</option>';
    });
    $("#unitsSelect").html(options);
    $("#unitsSelect").change(function() {
        $( "#unitsSelect option:selected" ).each(function() {
            var selectedUnitData = units[$(this).val()];
            if (selectedUnitData) {
                selectedUnit = selectedUnitData;
                $(baseStats).each(function (index, stat) {
                    $("#baseStat_" + stat).val(selectedUnitData.stats.maxStats[stat] + selectedUnitData.stats.pots[stat]);
		      	});
            } else {
                selectedUnit = '';
                $(baseStats).each(function (index, stat) {
                    $("#baseStat_" + stat).val("");
		      	});
            }
            displayUnitRarity(selectedUnitData);
        });
    });
}

// Displays selected unit's rarity by stars
var displayUnitRarity = function(unit) {
    var rarityWrapper = $('.unit-rarity');
    if (unit) {
        var rarity = unit.max_rarity;

        rarityWrapper.show();
        rarityWrapper.empty();

        for (var i = 0; i < rarity; i++) {
            rarityWrapper.append('<i class="rarity-star" />');
        }
    } else {
        rarityWrapper.hide();
    }
};

function inventoryLoaded() {
   
}
            
$(function() {
    $.get("data.json", function(result) {
        rawData = result;
    }, 'json').fail(function(jqXHR, textStatus, errorThrown ) {
        alert( errorThrown );
    });
    $.get("unitsWithSkill.json", function(result) {
        units = result;
        populateUnitSelect();
    }, 'json').fail(function(jqXHR, textStatus, errorThrown ) {
        alert( errorThrown );
    });
    $.get("espers.json", function(result) {
        espers = result;
    }, 'json').fail(function(jqXHR, textStatus, errorThrown ) {
        alert( errorThrown );
    });
    
    $("#buildButton").click(build);
    
    // Elements
	addImageChoicesTo("elements",["fire", "ice", "lightning", "water", "wind", "earth", "light", "dark"]);
    // Killers
	addTextChoicesTo("races",'checkbox',{'Aquatic':'aquatic', 'Beast':'beast', 'Bird':'bird', 'Bug':'bug', 'Demon':'demon', 'Dragon':'dragon', 'Human':'human', 'Machine':'machine', 'Plant':'plant', 'Undead':'undead', 'Stone':'stone', 'Spirit':'spirit'});
});
