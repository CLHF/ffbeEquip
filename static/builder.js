var goals = {
    "atk":{
        "useWeaponsElements":true,
        "applicableKillerType":"physical",
        "attackTwiceWithDualWield":true
     },
     "mag":{
        "useWeaponsElements":false,
        "applicableKillerType":"magical",
        "attackTwiceWithDualWield":false
     }
};

var useWeaponsElements = true;
var applicableKillerType = "physical";
var attackTwiceWithDualWield = true;

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
var ennemyDef = 100;
var ennemySpr = 100;
var innateElements = [];

var bestValue = 0;
var bestBuild;
var bestEsper;

var statToMaximize = "mag";

var stats = [];
var numberOfItemCombination;

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
    selectedUnit.name = selectedUnitName;
    
    readEnnemyResists();
    ennemyRaces = getSelectedValuesFor("races");
    innateElements = getSelectedValuesFor("elements");
    readGoal();
    
    prepareData(selectedUnit.equip);
    prepareEquipable();
    selectEspers();
    optimize();
}

function readGoal() {
    var goal = $(".goal select").val();
    var mecanismType;
    if (goal == "atk") {
        statToMaximize = goal;
        mecanismType = "atk";
    } else if (goal == "mag") {
        statToMaximize = goal;
        var attackType = $(".magicalSkillType input").val();
        if (attackType == "normal") {
            mecanismType = "mag";
        } else {
            mecanismType = "atk";
        }
    }
    useWeaponsElements = goals[mecanismType].useWeaponsElements;
    applicableKillerType = goals[mecanismType].applicableKillerType;
    attackTwiceWithDualWield = goals[mecanismType].attackTwiceWithDualWield;
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
                if ((item.special && item.special.includes("dualWield")) || item.partialDualWield) {
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
    if (goal == "hybrid") {
        for (var index in espers) {
            var foundStrictlyBetter = false;
            var strictlyWorseIndex = [];
            var newEsper = espers[index];
            for (var selectedEspersIndex in selectedEspers) {
                if (newEsper.atk > selectedEspers[selectedEspersIndex].atk && newEsper.mag > selectedEspers[selectedEspersIndex].mag) {
                    strictlyWorseIndex.push(selectedEspersIndex);
                }
                if (newEsper.atk < selectedEspers[selectedEspersIndex].atk && newEsper.mag < selectedEspers[selectedEspersIndex].mag) {
                    foundStrictlyBetter = true;
                }
            }
            if (!foundStrictlyBetter) {
                selectedEspers.push(newEsper);
            }
            for (var indexToRemove in strictlyWorseIndex) {
                selectedEspers.splice(strictlyWorseIndex[strictlyWorseIndex.length - indexToRemove - 1],1);
            }
        }
        for (var index in espers) {
            if (getKillerCoef(espers[index]) > 0 && !selectedEspers.includes(espers[index])) {
                selectedEspers.push(espers[index]);
            }
        }    
    } else {
        var maxValueEsper = null;
        for (var index in espers) {
            if (maxValueEsper == null || espers[index][statToMaximize] > maxValueEsper[statToMaximize]) {
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
}

function getKillerCoef(item) {
    var cumulatedKiller = 0;
    if (ennemyRaces.length > 0 && item.killers) {
        for (var killerIndex in item.killers) {
            if (ennemyRaces.includes(item.killers[killerIndex].name) && item.killers[killerIndex][applicableKillerType]) {
                cumulatedKiller += item.killers[killerIndex][applicableKillerType];
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
    
    var unitPartialDualWield = getInnatePartialDualWield();
    if (unitPartialDualWield) {
        var savedEquipable0 = equipable[0];
        var savedEquipable1 = equipable[1];
        
        equipable[0] = unitPartialDualWield;
        equipable[1] = unitPartialDualWield;
        buildTypeCombination(0,typeCombination,combinations);
        
        equipable[0] = savedEquipable0;
        equipable[1] = savedEquipable1;
    }
    if (!hasInnateDualWield() && dualWieldSources.length > 0) {
        for (var index in dualWieldSources) {
            var item = dualWieldSources[index];
            var slot = 0;
            if (item.type == "accessory") {
                slot = 4;
            } else if (item.type == "materia") {
                slot = 6;
            }
            fixedItems[slot] = item;
            var savedEquipable0 = equipable[0];
            if (item.partialDualWield && slot == 0) {
                equipable[0] = [item.type];
                equipable[1] = item.partialDualWield;
                var unitPartialDualWield = getInnatePartialDualWield();
                if (unitPartialDualWield) {
                    equipable[1] = mergeArrayWithoutDuplicates(equipable[1], unitPartialDualWield);
                }
            } else {
                equipable[1] = equipable[0];
            }
            buildTypeCombination(0,typeCombination,combinations);
            fixedItems[slot] = null;
            equipable[0] = savedEquipable0;
        }
    }
    console.log(combinations.length);
    
    
    findBestBuildForCombinationAsync(0, combinations);
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
    if (fixedItems[index]) {
        tryItem(index, build, typeCombination, dataWithConditionItems, fixedItems[index], fixedItems);
    } else {
        if (index == 1 && isTwoHanded(build[0])) {
            build[index] == null;
            findBestBuildForCombination(index + 1, build, typeCombination, dataWithConditionItems, fixedItems);    
        } else {
            if (typeCombination[index]  && dataWithConditionItems[typeCombination[index]].length > 0) {
                var foundAnItem = false;
                for (var itemIndex in dataWithConditionItems[typeCombination[index]]) {
                    var item = dataWithConditionItems[typeCombination[index]][itemIndex];
                    if (canAddMoreOfThisItem(build, item, index)) {
                        if (index == 1 && isTwoHanded(item)) {
                            continue;
                        }
                        tryItem(index, build, typeCombination, dataWithConditionItems, item, fixedItems);
                        foundAnItem = true;
                    }
                }
                if (!foundAnItem) {
                    tryItem(index, build, typeCombination, dataWithConditionItems, null, fixedItems);
                }
                build[index] == null;
            } else {
                findBestBuildForCombination(index + 1, build, typeCombination, dataWithConditionItems, fixedItems);
            }
        }
    }
}

function tryItem(index, build, typeCombination, dataWithConditionItems, item, fixedItems) {
    build[index] = item;
    if (index == 9) {
        numberOfItemCombination++
        for (var esperIndex in selectedEspers) {
            value = calculateValue(build, selectedEspers[esperIndex]);
            if (value > bestValue) {
                bestBuild = build.slice();
                bestValue = value;
                bestEsper = selectedEspers[esperIndex];
                logBuild(bestBuild, bestEsper);
            }    
        }
    } else {
        findBestBuildForCombination(index + 1, build, typeCombination, dataWithConditionItems, fixedItems);
    }
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
        var damageCoefLevel = getDamageCoefLevel(item);
        if (!damageCoefLevel || damageCoefLevelAlreadyKept[damageCoefLevel] && damageCoefLevelAlreadyKept[damageCoefLevel] >= numberNeeded) {
            tempResult.splice(itemIndex, 1);
        } else {
            if (!damageCoefLevelAlreadyKept[damageCoefLevel]) {
                damageCoefLevelAlreadyKept[damageCoefLevel] = 0;
            }
            damageCoefLevelAlreadyKept[damageCoefLevel] += getOwnedNumber(item);
            itemIndex++;
        }
    }
    var result = [];
    for (var index in tempResult) {
        result.push(tempResult[index].item);
    }
    return result;
}

function getDamageCoefLevel(item) {
    var damageCoefLevel = "neutral";
    var killerCoef = getKillerCoef(item);
    if (killerCoef > 0) {
        damageCoefLevel += "killer" + killerCoef;
    }
    if (weaponList.includes(item.type)) {
        // only for weapons
        if ((item.element && ennemyResist[item.element] != 0)) {
            damageCoefLevel += "element" + ennemyResist[item.element];
        }
        if (damageCoefLevel == "neutral" && (!item.element || innateElements.includes(item.element))) {
            damageCoefLevel = "elementless";
        }
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

function canAddMoreOfThisItem(build, item, currentIndex) {
    var number = 0;
    for (var index = 0; index < currentIndex; index++) {
        if (build[index] && build[index].name == item.name) {
            if (!isStackable(item)) {
                return false;
            }
            number++;
        }
    }
    for (var index = currentIndex + 1; index < 10; index++) {
        if (fixedItems[index] && fixedItems[index].name == item.name) {
            if (!isStackable(item)) {
                return false;
            }
            number++;
        }
    }
    return getOwnedNumber(item) > number;
}


function isStackable(item) {
    return !(item.special && item.special.includes("notStackable"));
}

function isTwoHanded(item) {
    return (item.special && item.special.includes("twoHanded"));
}

function hasInnateDualWield() {
    for (var index in selectedUnit.skills) {
        if (selectedUnit.skills[index].special && selectedUnit.skills[index].special.includes("dualWield")) {
            return true;
        }
    }
    return false;
}

function getInnatePartialDualWield() {
    for (var index in selectedUnit.skills) {
        if (selectedUnit.skills[index].partialDualWield) {
            return selectedUnit.skills[index].partialDualWield;
        }
    }
    return null;
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

function someEquipmentNoMoreApplicable(build) {
    for (var index in build) {
        if (build[index] && !isApplicable(build[index],build,5)) {
            return true;
        }
    }
    return false;
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

function calculateValue(equiped, esper) {
    if ("atk" == statToMaximize || "mag" == statToMaximize) {
        var calculatedValue = calculateStatValue(equiped, esper);
        
        var cumulatedKiller = 0;
        var itemAndPassives = equiped.concat(selectedUnit.skills);
        if (esper != null) {
            itemAndPassives.push(esper);
        }
        for (var equipedIndex in itemAndPassives) {
            if (itemAndPassives[equipedIndex] && (areConditionOK(itemAndPassives[equipedIndex], equiped))) {
                if (ennemyRaces.length > 0 && itemAndPassives[equipedIndex].killers) {
                    for (var killerIndex = 0; killerIndex <  itemAndPassives[equipedIndex].killers.length; killerIndex++) {
                        if (ennemyRaces.includes(itemAndPassives[equipedIndex].killers[killerIndex].name) && itemAndPassives[equipedIndex].killers[killerIndex][applicableKillerType]) {
                            cumulatedKiller += itemAndPassives[equipedIndex].killers[killerIndex][applicableKillerType];
                        }
                    }
                }
            }
        }
        
        // Element weakness/resistance
        var elements = innateElements.slice();
        if (useWeaponsElements) {
            if (equiped[0] && equiped[0].element && !elements.includes(equiped[0].element)) {
                elements.push(equiped[0].element);
            };
            if (equiped[1] && equiped[1].element && !elements.includes(equiped[1].element)) {
                elements.push(equiped[1].element);
            };
        }
        var resistModifier = 0;
        
        if (elements.length > 0) {
            for (var element in ennemyResist) {
                if (equiped[0] && equiped[0].element && equiped[0].element == element || equiped[1] && equiped[1].element && equiped[1].element == element) {
                    resistModifier += ennemyResist[element] / 100;
                }
            }    
            resistModifier = resistModifier / elements.length;
        }
        
        // Killers
        var killerMultiplicator = 1;
        if (ennemyRaces.length > 0) {
            killerMultiplicator += (cumulatedKiller / 100) / ennemyRaces.length;
        }
        
        if ("atk" == statToMaximize) {
            return (calculatedValue.right * calculatedValue.right + calculatedValue.left * calculatedValue.left) * (1 - resistModifier) * killerMultiplicator;
        } else {
            var dualWieldCoef = 1;
            if (attackTwiceWithDualWield) {
                dualWieldCoef = 2;
            }
            return (calculatedValue.total * calculatedValue.total) * (1 - resistModifier) * killerMultiplicator * dualWieldCoef; 
        }
    }
}

function calculateStatValue(equiped, esper) {
    
    var indexToStart = 0;
    if ("atk" == statToMaximize) {
        var indexToStart = 2;
    } 
        
    var calculatedValue = 0   
    var baseValue = selectedUnit.stats.maxStats[statToMaximize] + selectedUnit.stats.pots[statToMaximize];
    var calculatedValue = baseValue;
    var itemAndPassives = equiped.concat(selectedUnit.skills);

    for (var equipedIndex = indexToStart; equipedIndex < itemAndPassives.length; equipedIndex++) {
        calculatedValue += calculateStateValueForIndex(equiped, itemAndPassives, equipedIndex, baseValue);
    }
    if (esper != null) {
        calculatedValue += esper[statToMaximize] / 100;
    }
    
    if ("atk" == statToMaximize) {
        var result = {"right":0,"left":0,"total":0}; 
        var right = calculateStateValueForIndex(equiped, itemAndPassives, 0, baseValue);
        var left = calculateStateValueForIndex(equiped, itemAndPassives, 1, baseValue);
        if (equiped[1] && weaponList.includes(equiped[1].type)) {
            result.right = calculatedValue + right;
            result.left = calculatedValue + left;
            result.total = calculatedValue + right + left;    
        } else {
            result.right = calculatedValue + right + left;
            result.total = result.right;
        }
        return result;   
    } else {
        return {"total" : calculatedValue};
    }
}

function calculateStateValueForIndex(equiped, itemAndPassives, equipedIndex, baseValue) {
    var value = 0;
    if (itemAndPassives[equipedIndex] && (equipedIndex < 10 || areConditionOK(itemAndPassives[equipedIndex], equiped))) {
        if (itemAndPassives[equipedIndex][statToMaximize]) {
            value += itemAndPassives[equipedIndex][statToMaximize];
        }
        if (itemAndPassives[equipedIndex][statToMaximize + '%']) {
            value += itemAndPassives[equipedIndex][statToMaximize+'%'] * baseValue / 100;
        }
    }
    return value;
}

function areConditionOK(item, equiped) {
    if (item.equipedConditions) {
        var found = 0;
        for (var conditionIndex in item.equipedConditions) {
            for (var equipedIndex in equiped) {
                if (equiped[equipedIndex] && equiped[equipedIndex].type == item.equipedConditions[conditionIndex]) {
                    found ++;
                    break;
                }
            }
        }
        if (found != item.equipedConditions.length) {
            return false;
        }
    }
    return true;
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
    $("#resultStats").html(statToMaximize + " = " + Math.floor(calculateStatValue(build, esper).total) + ' , damage (on 100 def) = ' + Math.floor(calculateValue(build, esper) / 100) + ". esper : " + esper.name);
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

function onGoalChange() {
    var goal = $(".goal select").val();
    if (goal == "mag") {
        $(".magicalSkillType").removeClass("hidden");
    } else {
        $(".magicalSkillType").addClass("hidden");
    }
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
    
    $(".goal select").change(onGoalChange);
    onGoalChange();
    
    $("#buildButton").click(build);
    
    // Elements
	addImageChoicesTo("elements",["fire", "ice", "lightning", "water", "wind", "earth", "light", "dark"]);
    // Killers
	addTextChoicesTo("races",'checkbox',{'Aquatic':'aquatic', 'Beast':'beast', 'Bird':'bird', 'Bug':'bug', 'Demon':'demon', 'Dragon':'dragon', 'Human':'human', 'Machine':'machine', 'Plant':'plant', 'Undead':'undead', 'Stone':'stone', 'Spirit':'spirit'});
});
