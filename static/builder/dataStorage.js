class DataStorage {
    constructor() {
        this.onlyUseOwnedItems = false;
        this.onlyUseShopRecipeItems = false;
        this.exludeEventEquipment = false;
        this.excludeNotReleasedYet = true;
        this.excludeTMR5 = false;
        this.exludeEventEquipment = false;
        this.excludePremium = false;
        this.excludeSTMR = false;
        this.onlyUseOwnedItemsAvailableForExpeditions = false;
        this.includeTrialRewards = false;
        this.includeTMROfOwnedUnits = false;
        this.alreadyUsedItems = {};
        this.unstackablePinnedItems = [];
        this.alreadyUsedEspers = [];
        this.itemInventory;
    }
    
    setData(data) {
        this.data = data;
        this.prepareAllItemsVersion();
    }
    
    prepareAllItemsVersion() {
        this.allItemVersions = {};
        this.itemWithVariation = {};
        var currentId = 0;
        var currentItemVersions = [];
        for (var index = 0, len = this.data.length; index < len; index++) {
            var item = this.data[index];
            item.meanDamageVariance = 1;
            if (item.damageVariance) {
                item.damageVariance.avg = (item.damageVariance.min + item.damageVariance.max) / 2;
                item.meanDamageVariance = item.damageVariance.avg;
            }
            if (item.id != currentId) {
                if (currentItemVersions.length > 1 || (currentItemVersions.length == 1 && currentItemVersions[0].equipedConditions)) {
                    this.itemWithVariation[currentId] = currentItemVersions;
                }
                this.allItemVersions[currentId] = currentItemVersions;
                currentId = item.id;
                currentItemVersions = [];
            }
            currentItemVersions.push(item);
        }
        if (currentItemVersions.length > 1) {
            this.itemWithVariation[currentId] = currentItemVersions;
        }
        this.allItemVersions[currentId] = currentItemVersions;
    }
    
    setItemsToExclude(itemsToExclude) {
        this.itemsToExclude = itemsToExclude;
    }
    
    setUnitBuild(unitBuild) {
        this.unitBuild = unitBuild;
        this.desirableElements = [];
        this.desiredEquipmentType = [];
        for (var index = 0, len = this.unitBuild.unit.skills.length; index < len; index++) {
            var skill = this.unitBuild.unit.skills[index];
            if (skill.equipedConditions) {
                for (var i = skill.equipedConditions.length; i--;) {
                    var condition = skill.equipedConditions[i];
                    if (elementList.includes(condition)) {
                        if (!this.desirableElements.includes(condition)) {
                            this.desirableElements.push(skill.equipedConditions[0]);    
                        }
                    } else if (!this.desiredEquipmentType.includes(condition)) {
                        this.desiredEquipmentType.push(condition);
                    }
                }
            }
        }
        this.prepareAllItemsVersion();
    }
    
    prepareData(itemsToExclude, ennemyStats) {
        this.dataByType = {};
        this.dataWithCondition = [];
        this.dualWieldSources = [];
        this.equipSources = [];
        this.weaponsByTypeAndHands = {};
        for (var i = weaponList.length; i--;) {
            this.weaponsByTypeAndHands[weaponList[i]] = {};
        }
        var tempData = {};
        var adventurersAvailable = {};
        var alreadyAddedIds = [];
        var equipable = this.unitBuild.getCurrentUnitEquip();
        var itemNumber = this.data.length;
        var pinnedItemIds = [];
        for (var i = 0; i < 10; i++) {
            if (this.unitBuild.fixedItems[i]) {
                pinnedItemIds.push(this.unitBuild.fixedItems[i].id);
            }
        }

        
        for (var index = 0; index < itemNumber; index++) {
            var item = this.data[this.data.length - 1 - index];
            var availableNumbers = this.getAvailableNumbers(item);
            var availableNumber = availableNumbers.available;
            var ownedAvailableNumber = Math.max(availableNumber - availableNumbers.total + availableNumbers.totalOwnedNumber, 0);
            if (itemsToExclude.includes(item.id)) {
                continue;
            }
            
            var addedToItems = false;
            
            if (availableNumber > 0 && this.unitBuild && this.unitBuild.unit && this.unitBuild.unit.tmrSkill && item.tmrUnit && item.tmrUnit == this.unitBuild.unit.id && !item.originalItem) {
                addedToItems = this.prepareItem(getItemWithTmrSkillIfApplicable(item, this.unitBuild.unit), this.unitBuild.baseValues, ennemyStats, 1, ownedAvailableNumber, adventurersAvailable, alreadyAddedIds, equipable, pinnedItemIds, true) || addedToItems;
                availableNumber--;
                if (ownedAvailableNumber > 0) {
                    ownedAvailableNumber--;
                }
            } 
            
            if (availableNumber > 0 && this.onlyUseOwnedItems && this.itemInventory && this.itemInventory.enchantments && this.itemInventory.enchantments[item.id]) {
                var enhancementsAvailables = this.itemInventory.enchantments[item.id].slice();
                if (this.alreadyUsedItems.enhancements[item.id]) {
                    for (var i = this.alreadyUsedItems.enhancements[item.id].length; i--;) {
                        var enhancementString = JSON.stringify(this.alreadyUsedItems.enhancements[item.id][i]);
                        for (var j = enhancementsAvailables.length; j--;) {
                            if (enhancementString == JSON.stringify(this.itemInventory.enchantments[item.id][j])) {
                                enhancementsAvailables.splice(j, 1);
                                break;
                            }
                        }
                    }
                }
                for (var i = enhancementsAvailables.length; i--;) {
                    addedToItems = this.prepareItem(applyEnhancements(item, enhancementsAvailables[i]), this.unitBuild.baseValues, ennemyStats, 1, ownedAvailableNumber, adventurersAvailable, alreadyAddedIds, equipable, pinnedItemIds, true) || addedToItems;
                    availableNumber--;
                    if (ownedAvailableNumber > 0) {
                        ownedAvailableNumber--;
                    }
                }
            }
            
            if (availableNumber > 0) {
                addedToItems = this.prepareItem(item, this.unitBuild.baseValues, ennemyStats, availableNumber, ownedAvailableNumber, adventurersAvailable, alreadyAddedIds, equipable, pinnedItemIds) || addedToItems;  
            }
            if (addedToItems && !alreadyAddedIds.includes(item.id)) {
                alreadyAddedIds.push(item.id);
            }
        }
        var adventurerAlreadyPinned = false;
        for (var index = 6; index < 10; index++) {
            if (this.unitBuild.fixedItems[index] && adventurerIds.includes(this.unitBuild.fixedItems[index].id)) {
                adventurerAlreadyPinned = true;
                break;
            }
        }
        if (!adventurerAlreadyPinned) {
            for (var index = adventurerIds.length -1; index >=0; index--) { // Manage adventurers  to only keep the best available
                if (adventurersAvailable[adventurerIds[index]]) {
                    if (!this.dataByType["materia"]) {
                        this.dataByType["materia"] = [];
                    }
                    var item = adventurersAvailable[adventurerIds[index]];
                    var availableNumbers = this.getAvailableNumbers(item);
                    var availableNumber = availableNumbers.available;
                    var ownedAvailableNumber = Math.max(availableNumber - availableNumbers.total + availableNumbers.totalOwnedNumber, 0);
                    this.dataByType["materia"].push(this.getItemEntry(item, availableNumber, ownedAvailableNumber > 0));
                    break;
                }
            }
        }
        this.dataWithCondition.sort(function(entry1, entry2) {
            if (entry1.item.id == entry2.item.id) {
                if (entry1.item.originalItem) {
                    if (entry2.item.originalItem) {
                        return entry2.item.equipedConditions.length - entry1.item.equipedConditions.length; 
                    } else {
                        return -1;
                    }
                } else {
                    if (entry2.item.originalItem) {
                        return 1;
                    } else {
                        return entry2.item.equipedConditions.length - entry1.item.equipedConditions.length;
                    }
                }
                return entry2.item.equipedConditions.length - entry1.item.equipedConditions.length;
            } else {
                return entry1.item.id - entry2.item.id;
            }
        })
        var desirableElements = null;
        if (builds[currentUnitIndex].formula.type == "condition" && builds[currentUnitIndex].formula.elements) {
            desirableElements = builds[currentUnitIndex].formula.elements;
        }
        for (var typeIndex = 0, len = typeList.length; typeIndex < len; typeIndex++) {
            var type = typeList[typeIndex];
            if (this.dataByType[type] && this.dataByType[type].length > 0) {
                var numberNeeded = 1;
                if (weaponList.includes(type) || type == "accessory") {numberNeeded = 2}
                if (type == "materia") {numberNeeded = 4}
                var tree = ItemTreeComparator.sort(this.dataByType[type], numberNeeded, this.unitBuild, ennemyStats, desirableElements);
                this.dataByType[type] = [];
                for (var index = 0, lenChildren = tree.children.length; index < lenChildren; index++) {
                    this.addEntriesToResult(tree.children[index], this.dataByType[type], 0, true);    
                }
            } else {
                this.dataByType[type] = [{"item":getPlaceHolder(type),"available":numberNeeded}];  
            }
        }
        // Manage dual wield sources
        var dualWieldByType = {};
        for (var i = this.dualWieldSources.length; i--;) {
            var entry = this.dualWieldSources[i];
            if (entry.item.partialDualWield) {
                if (!dualWieldByType[entry.item.type + "partial"]) {
                    dualWieldByType[entry.item.type + "partial"] = [];
                }
                
                dualWieldByType[entry.item.type + "partial"].push(entry);
            } else {
                if (!dualWieldByType[entry.item.type]) {
                    dualWieldByType[entry.item.type] = [];
                }
                dualWieldByType[entry.item.type].push(entry);
            }
        }
        var types = Object.keys(dualWieldByType);
        this.dualWieldSources = [];
        for (var i = types.length; i--;) {
            var tree = ItemTreeComparator.sort(dualWieldByType[types[i]], numberNeeded, this.unitBuild, ennemyStats, desirableElements);
            for (var index = 0, lenChildren = tree.children.length; index < lenChildren; index++) {
                this.dualWieldSources.push(tree.children[index].equivalents[0].item);
            }
        }
    }
    
    addEntriesToResult(tree, result, keptNumber, keepEntry) {
        tree.equivalents.sort(function(entry1, entry2) {
            if (entry1.defenseValue == entry2.defenseValue) {
                if (entry2.available == entry1.available) {
                    return getValue(entry2.item, "atk%") + getValue(entry2.item, "mag%") + getValue(entry2.item, "atk") + getValue(entry2.item, "mag") - (getValue(entry1.item, "atk%") + getValue(entry1.item, "mag%") + getValue(entry1.item, "atk") + getValue(entry1.item, "mag"))
                } else {
                    return entry2.available - entry1.available;    
                }
            } else {
                return entry2.defenseValue - entry1.defenseValue;    
            }
        });
        for (var index = 0, len = tree.equivalents.length; index < len; index++) {
            if (keepEntry) {
                result.push(tree.equivalents[index]);
            } else {
                result.push(tree.equivalents[index].item);
            }
        }
        for (var index = 0, len = tree.children.length; index < len; index++) {
            this.addEntriesToResult(tree.children[index], result, keptNumber, keepEntry);    
        }
    }

    getItemEntry(item, availableNumber = null, owned = false) {
        return {
            "item":item, 
            "name":item.name, 
            "defenseValue":this.getDefenseValue(item),
            "available":availableNumber || this.getAvailableNumbers(item).available,
            "owned": owned
        };
    }
    
    getDefenseValue(item) {
        var hpBaseValue = this.unitBuild.baseValues.hp.total;
        var defBaseValue = this.unitBuild.baseValues.def.total;
        var sprBaseValue = this.unitBuild.baseValues.spr.total;
        return this.getStatValueIfExists(item, "hp", hpBaseValue) + this.getStatValueIfExists(item, "def", defBaseValue) + this.getStatValueIfExists(item, "spr", sprBaseValue);
    }
    
    getStatValueIfExists(item, stat, baseStat) {
        var result = 0;
        if (item[stat]) result += item[stat];
        if (item[percentValues[stat]]) result += item[percentValues[stat]] * baseStat / 100;
        return result;
    }

    prepareItem(item, baseValues, ennemyStats, availableNumber, ownedAvailableNumber, adventurersAvailable, alreadyAddedIds, equipable, pinnedItemIds, tmrAbilityEnhancedItem = false) {
        var added = false;
        for (var index = 0, len = baseStats.length; index < len; index++) {
            item['total_' + baseStats[index]] = this.getStatValueIfExists(item, baseStats[index], baseValues[baseStats[index]].total);
        }
        if (item.element && !includeAll(this.unitBuild.innateElements, item.element)) {
            item.elementType = "element_" + getElementCoef(item.element, ennemyStats);
        } else {
            item.elementType = "neutral"
        }
        if (availableNumber > 0 && isApplicable(item, this.unitBuild.unit)) {
            if ((item.special && item.special.includes("dualWield")) || (item.partialDualWield && matches(equipable, item.partialDualWield))) {
                this.dualWieldSources.push(this.getItemEntry(item, 1, ownedAvailableNumber > 0));
            }
            if (item.allowUseOf && !equipable.includes(item.allowUseOf)) {
                this.equipSources.push(item);
            } 
            if (this.itemCanBeOfUseForGoal(item, ennemyStats)) {
                if (adventurerIds.includes(item.id)) { // Manage adventurers to only keep the best available
                    adventurersAvailable[item.id] = item;
                    return;
                }
                if (item.equipedConditions) {
                        if (ownedAvailableNumber < availableNumber) {
                            if (ownedAvailableNumber > 0) {
                                this.dataWithCondition.push(this.getItemEntry(item, ownedAvailableNumber, true));
                            }
                            this.dataWithCondition.push(this.getItemEntry(item, availableNumber - ownedAvailableNumber, false));
                        } else {
                            this.dataWithCondition.push(this.getItemEntry(item, availableNumber, true));
                        }
                } else {
                    if (!alreadyAddedIds.includes(item.id)) {
                        if (!this.dataByType[item.type]) {
                            this.dataByType[item.type] = [];
                        }
                        if (ownedAvailableNumber < availableNumber) {
                            if (ownedAvailableNumber > 0) {
                                this.dataByType[item.type].push(this.getItemEntry(item, ownedAvailableNumber, true));
                            }
                            this.dataByType[item.type].push(this.getItemEntry(item, availableNumber - ownedAvailableNumber, false));
                        } else {
                            this.dataByType[item.type].push(this.getItemEntry(item, availableNumber, true));
                        }
                        if (!tmrAbilityEnhancedItem) {
                            alreadyAddedIds.push(item.id);
                        }
                        added = true;
                    }
                }
            }
            if (weaponList.includes(item.type)) {
                this.addToWeaponsByTypeAndHands(item);
            }
        } else if (pinnedItemIds.includes(item.id)) {
            this.addToWeaponsByTypeAndHands(item);
        }
        return added;
    }

    addToWeaponsByTypeAndHands(item) {
        if (weaponList.includes(item.type)) {
            if (!this.weaponsByTypeAndHands[item.type]) {
                this.weaponsByTypeAndHands[item.type] = {};
            }
            var handNumber = 1;
            if (item.special && item.special.includes("twoHanded")) {
                handNumber = 2;   
            }
            if (!this.weaponsByTypeAndHands[item.type][handNumber]) {
                this.weaponsByTypeAndHands[item.type][handNumber] = 0;
            }
            this.weaponsByTypeAndHands[item.type][handNumber]++;
        }
    }
    
    itemCanBeOfUseForGoal(item, ennemyStats) {
        if (builds[currentUnitIndex].formula.type == "condition" && builds[currentUnitIndex].formula.elements && item.element) {
            if (builds[currentUnitIndex].formula.elements.includes("none") ) {
                return false;
            } else if (!includeAll(builds[currentUnitIndex].formula.elements, item.element)) {
                return false;
            } else {
                return true;
            }
        }
        
        
        var stats = builds[currentUnitIndex].involvedStats;

        for (var index = 0, len = stats.length; index < len; index++) {
            if (stats[index] == "weaponElement") {
                if (item.element && getElementCoef(item.element, ennemyStats) < 0) return true;
            } else if (stats[index] == "physicalKiller") {
                if (this.getKillerCoef(item, "physical") > 0) return true;
            } else if (stats[index] == "magicalKiller") {
                if (this.getKillerCoef(item, "magical") > 0) return true;
            } else if (stats[index] == "lbPerTurn") {
                if (item.lbPerTurn || item.lbFillRate) return true;
            } else {
                if (getValue(item, stats[index]) > 0) return true;
                if (item["total_" + stats[index]]) return true;
                if (item.singleWielding && item.singleWielding[stats[index]]) return true;
                if (item.singleWieldingGL && item.singleWieldingGL[stats[index]]) return true;
                if (item.singleWieldingOneHanded && item.singleWieldingOneHanded[stats[index]]) return true;
                if (item.singleWieldingOneHandedGL && item.singleWieldingOneHandedGL[stats[index]]) return true;
            }
        }
        if (this.desirableElements.length != 0) {
            if (item.element && matches(item.element, this.desirableElements)) return true;
        }
        if (this.desiredEquipmentType.length != 0) {
            if (item.type && this.desiredEquipmentType.includes(item.type)) return true;
        }
    }
    
    getKillerCoef(item, applicableKillerType) {
        var cumulatedKiller = 0;
        if (ennemyStats.races.length > 0 && item.killers) {
            for (var killerIndex = item.killers.length; killerIndex--;) {
                if (ennemyStats.races.includes(item.killers[killerIndex].name) && item.killers[killerIndex][applicableKillerType]) {
                    cumulatedKiller += item.killers[killerIndex][applicableKillerType];
                }
            }
        }
        return cumulatedKiller / ennemyStats.races.length;
    }
    
    getAvailableNumbers(item) {
        if (this.onlyUseOwnedItems) {
            var numbers = this.getOwnedNumber(item);
            if (!isStackable(item)) {
                numbers.available = Math.min(numbers.available,1);
            }
            return numbers;
        } else {
            var number;
            if (this.onlyUseShopRecipeItems) {
                if (item.maxNumber || adventurerIds.includes(item.id)) {
                    return {"total":0,"available":0,"totalOwnedNumber":0};
                }
                var shopRecipe = false;
                for (var index = item.access.length; index--;) {
                    var access = item.access[index];
                    if (access.startsWith("recipe") || access == "shop") {
                        if (access.endsWith("event")) {
                            return {"total":0,"available":0,"totalOwnedNumber":0};
                        }       
                        shopRecipe = true;
                        if (!this.exludeEventEquipment) {
                            break;
                        }
                    } 
                }
                if (shopRecipe) {
                    return {"total":4,"available":4,"totalOwnedNumber":0};
                } else {
                    return {"total":0,"available":0,"totalOwnedNumber":0};
                }
            } else {
                if (this.excludeNotReleasedYet || this.excludeTMR5 || this.exludeEventEquipment || this.excludePremium || this.excludeSTMR) {
                    for (var index = item.access.length; index--;) {
                        var access = item.access[index];
                        if ((this.excludeNotReleasedYet && access == "not released yet")
                           || (this.excludeTMR5 && access.startsWith("TMR-5*") && item.tmrUnit != builds[currentUnitIndex].unit.id)
                           || (this.exludeEventEquipment && access.endsWith("event"))
                           || (this.excludePremium && access == "premium")
                           || (this.excludeSTMR && access == "STMR")) {
                            return {"total":0,"available":0,"totalOwnedNumber":0};
                        }        
                    }
                }
                number = 4;
                if (item.maxNumber) {
                    if (this.alreadyUsedItems[item.id]) {
                        number = item.maxNumber - this.alreadyUsedItems[item.id];
                    } else {
                        number = item.maxNumber;
                    }
                }
                if (!isStackable(item)) {
                    if (this.unstackablePinnedItems.includes(item.id)) {
                        number = 0;
                    } else {
                        number = 1;
                    }
                }
            }
            if (!isStackable(item)) {
                number = Math.min(number,1);
            }
            return {"total":number,"available":number,"totalOwnedNumber":0};
        }
    }

    getOwnedNumber(item) {
        var totalNumber = 0;
        var totalOwnedNumber = 0;
        var availableNumber = 0;
        if (this.onlyUseOwnedItemsAvailableForExpeditions && this.itemInventory.excludeFromExpeditions.includes(item.id)) {
            return {"total":0,"available":0,"totalOwnedNumber":0}
        }
        if (this.itemInventory[item.id]) {
            totalNumber = this.itemInventory[item.id];
        }
        totalOwnedNumber = totalNumber;
        if (this.includeTMROfOwnedUnits) {
            if (item.tmrUnit && ownedUnits[item.tmrUnit]) {
                totalNumber += ownedUnits[item.tmrUnit].farmable;
            }
        }
        if (this.includeTrialRewards && totalNumber == 0 && item.access.includes("trial")) {
            totalNumber += 1;
        }

        if (this.alreadyUsedItems[item.id]) {
            availableNumber = Math.max(0, totalNumber - this.alreadyUsedItems[item.id]);
            if (!isStackable(item)) {
                if (this.unstackablePinnedItems.includes(item.id)) {
                    availableNumber = 0
                } else {
                    availableNumber = Math.min(1, availableNumber);
                }
            }
        } else{
            availableNumber = totalNumber;
        }
        return {"total":totalNumber,"available":availableNumber,"totalOwnedNumber":totalOwnedNumber};
    }
    
    calculateAlreadyUsedItems(builds, currentUnitIndex) {
        this.alreadyUsedItems = {"enhancements":{}};
        this.unstackablePinnedItems = [];
        this.alreadyUsedEspers = [];
        for (var i = 0, len = builds.length; i < len; i++) {
            if (i != currentUnitIndex) {
                var build = builds[i].build;
                for (var j = 0, len2 = build.length; j < len2; j++) {
                    var item = build[j];
                    if (item) {
                        if (this.alreadyUsedItems[item.id]) {
                            this.alreadyUsedItems[item.id]++;
                        } else {
                            this.alreadyUsedItems[item.id] = 1;
                        }
                        if (item.enhancements) {
                            if (!this.alreadyUsedItems.enhancements[item.id]) {
                                this.alreadyUsedItems.enhancements[item.id] = [];
                            }
                            this.alreadyUsedItems.enhancements[item.id].push(item.enhancements);
                        }
                    }
                }
                if (build[10]) {
                    this.alreadyUsedEspers.push(build[10].id);
                }
            } else {
                for (var index = 0; index < 10; index++) {
                    if (builds[i].fixedItems[index]) {
                        var item = builds[i].fixedItems[index];
                        if (item) {
                            if (this.alreadyUsedItems[item.id]) {
                                this.alreadyUsedItems[item.id]++;
                            } else {
                                this.alreadyUsedItems[item.id] = 1;
                            }
                            if (item.enhancements) {
                                if (!this.alreadyUsedItems.enhancements[item.id]) {
                                    this.alreadyUsedItems.enhancements[item.id] = [];
                                }
                                this.alreadyUsedItems.enhancements[item.id].push(item.enhancements);
                            }
                            if (!isStackable(item)) {
                                this.unstackablePinnedItems.push(item.id);
                            }
                        }   
                    }
                }
                if (builds[i].build[10]) {
                    this.alreadyUsedEspers.push(builds[i].build[10].id);
                }
            }
        }
    }
}