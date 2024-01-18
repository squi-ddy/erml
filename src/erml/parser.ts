import Attribute from "./types/attribute"
import Entity from "./types/entity"
import Relationship from "./types/relationship"
import SubclassRelationship from "./types/subclassRelationship"

enum LineEntityTypes {
    ENTITY,
    RELATIONSHIP,
}

const LineEntityTypesDisplay = {
    [LineEntityTypes.ENTITY]: "entity",
    [LineEntityTypes.RELATIONSHIP]: "relationship",
}

type LineHasSymbol = {
    hasSymbol: true
    symbol: string
    type: LineEntityTypes
}

type LineNoSymbol = {
    hasSymbol: false
}

type LineSymbol = LineHasSymbol | LineNoSymbol

enum LineTypes {
    SYMBOL_DEFINITION,
    PLUS,
    SUBCLASS_DEFINITION,
    SUBCLASS_REFERENCE,
}

export default class Parser {
    readonly script: string
    #parsed: boolean
    readonly _scriptLine: string[]
    readonly _scriptLineMap: number[]
    readonly _scriptSplit: string[]
    readonly _scriptLineNoSymbolPlusMerged: string[]
    readonly _lineType: LineTypes[]
    readonly _scriptLineNoSymbol: string[]
    readonly _entitySymbolsMap: Map<string, [number, Entity]>
    readonly _relationshipSymbolsMap: Map<string, [number, Relationship]>
    readonly _lineSymbols: LineSymbol[]
    readonly _lineOwnedBy: number[] // index of line that owns this line
    readonly _whitespaceStack: [number, number][] // whitespace length, owning line index
    readonly _ownLevel: number[] // level of indentation; ensure all objects owned by the same line have the same level of indentation

    constructor(script: string) {
        this.script = script
        // split by line
        this._scriptSplit = script.split("\n")
        this._scriptLine = []
        this._scriptLineMap = []
        this._lineType = []
        this._entitySymbolsMap = new Map()
        this._relationshipSymbolsMap = new Map()
        this._lineSymbols = []
        this.#parsed = false
        this._lineOwnedBy = []
        this._whitespaceStack = [[-1, -1]]
        this._ownLevel = []
        this._scriptLineNoSymbol = []
        this._scriptLineNoSymbolPlusMerged = []
    }

    _parseSymbols() {
        for (let i = 0; i < this._scriptLine.length; i++) {
            const line = this._scriptLine[i]
            const splitByColon = line.split(":")
            if (splitByColon.length > 2) {
                throw new Error(`Too many ':' in line ${i + 1}`)
            } else if (splitByColon.length === 1) {
                this._lineSymbols.push({ hasSymbol: false })
                this._scriptLineNoSymbol.push(line.trim())
                continue
            }
            let symbol = splitByColon[0].trim()
            this._scriptLineNoSymbol.push(splitByColon[1].trim())
            if (symbol.startsWith("<") && symbol.endsWith(">")) {
                // relationship
                symbol = symbol.substring(1, symbol.length - 1).trim()
                this._relationshipSymbolsMap.set(symbol, [
                    i,
                    {
                        name: symbol,
                        endpoints: [],
                        attributes: [],
                        isOwning: false,
                    },
                ])
                this._lineSymbols.push({
                    hasSymbol: true,
                    symbol: symbol,
                    type: LineEntityTypes.RELATIONSHIP,
                })
            } else {
                // normal entity
                this._entitySymbolsMap.set(symbol, [
                    i,
                    {
                        name: symbol,
                        attributes: [],
                        relationships: [],
                        subclassRelationships: [],
                        isWeak: false,
                    },
                ])
                this._lineSymbols.push({
                    hasSymbol: true,
                    symbol: symbol,
                    type: LineEntityTypes.ENTITY,
                })
            }
            if (symbol.length === 0) {
                throw new Error(`Symbol cannot be empty on line ${i + 1}`)
            }
        }
    }

    _validateSymbolNames() {
        for (const [
            symbol,
            [symbolLine, _],
        ] of this._entitySymbolsMap.entries()) {
            if (!symbol.match(/^[a-zA-Z0-9_-]+$/)) {
                throw new Error(
                    `${this._lineToSymbolDisplay(
                        symbolLine,
                        true,
                    )} is not valid, should only contain alphanumeric characters, underscores and dashes`,
                )
            }
        }
        for (const [
            symbol,
            [symbolLine, _],
        ] of this._relationshipSymbolsMap.entries()) {
            if (!symbol.match(/^[a-zA-Z0-9_-]+$/)) {
                throw new Error(
                    `${this._lineToSymbolDisplay(
                        symbolLine,
                        true,
                    )} is not valid, should only contain alphanumeric characters, underscores and dashes`,
                )
            }
        }
    }

    _validateDefinitions() {
        // make sure all symbols are only defined once
        const seenSymbols = new Map<string, number>()
        for (let i = 0; i < this._scriptLine.length; i++) {
            const lineSymbol = this._lineSymbols[i]
            if (!lineSymbol.hasSymbol) continue
            const lastSymbolLine = seenSymbols.get(lineSymbol.symbol)
            if (lastSymbolLine) {
                throw new Error(
                    `${this._lineToSymbolDisplay(
                        i,
                        true,
                    )} is redefined: conflicts with ${this._lineToSymbolDisplay(
                        lastSymbolLine,
                        false,
                    )}`,
                )
            }
            seenSymbols.set(lineSymbol.symbol, i)
        }
    }

    _lineToSymbol(line: number): LineHasSymbol | null {
        const lineSymbol = this._lineSymbols[line]
        if (lineSymbol.hasSymbol) {
            return lineSymbol
        }
        return null
    }

    _lineToSymbolDisplay(lineNum: number, caps: boolean): string {
        const lineSymbol = this._lineToSymbol(lineNum)
        const lineNumReal = this._scriptLineMap[lineNum]
        let retString
        if (lineSymbol === null) {
            retString = `line ${lineNumReal + 1}`
        } else {
            retString = `${LineEntityTypesDisplay[lineSymbol.type]} '${
                lineSymbol.symbol
            }' (line ${lineNumReal + 1})`
        }
        if (caps) {
            retString = retString[0].toUpperCase() + retString.substring(1)
        }
        return retString
    }

    _lineDisplay(lineNum: number, caps: boolean): string {
        const retString = `line ${this._scriptLineMap[lineNum] + 1}`
        if (caps) {
            return retString[0].toUpperCase() + retString.substring(1)
        }
        return retString
    }

    _parseWhitespace() {
        for (let i = 0; i < this._scriptLine.length; i++) {
            const line = this._scriptLine[i]
            this._ownLevel.push(-1)
            const whitespace = (line.match(/^[ \t]+/) ?? [""])[0]
            let whitespaceLength = 0
            for (const char of whitespace) {
                if (char === " ") {
                    whitespaceLength++
                } else if (char === "\t") {
                    whitespaceLength += 4
                }
            }

            if (i === 0) {
                if (whitespaceLength > 0) {
                    throw new Error(
                        `First line of script (${this._lineDisplay(
                            0,
                            false,
                        )}) cannot have whitespace`,
                    )
                }
            }

            // push yourself onto the stack
            while (
                this._whitespaceStack[this._whitespaceStack.length - 1][0] >=
                whitespaceLength
            ) {
                this._whitespaceStack.pop()
            }
            this._whitespaceStack.push([whitespaceLength, i])

            // owned by the last line on the stack
            const owner =
                this._whitespaceStack[this._whitespaceStack.length - 2][1]
            this._lineOwnedBy.push(owner)

            // set/check own level
            if (owner !== -1) {
                if (this._ownLevel[owner] === -1) {
                    this._ownLevel[owner] = whitespaceLength
                } else if (this._ownLevel[owner] !== whitespaceLength) {
                    throw new Error(
                        `Children of ${this._lineToSymbolDisplay(
                            owner,
                            false,
                        )} have inconsistent indentation: ${this._lineToSymbolDisplay(
                            i,
                            true,
                        )} has different indentation`,
                    )
                }
            }
        }
    }

    _validateOwnership() {
        // make sure all lines are owned by an entity
        for (let i = 0; i < this._lineOwnedBy.length; i++) {
            const ownerLine = this._lineOwnedBy[i]
            if (ownerLine === -1) {
                continue
            }
            const owner = this._lineSymbols[ownerLine]
            if (
                !owner ||
                !owner.hasSymbol ||
                owner.type === LineEntityTypes.RELATIONSHIP
            ) {
                throw new Error(
                    `${this._lineToSymbolDisplay(
                        i,
                        true,
                    )} cannot be owned by ${this._lineToSymbolDisplay(
                        ownerLine,
                        false,
                    )}`,
                )
            }
        }
    }

    _attributeDisplay(
        lineNum: number,
        attrName: string,
        caps: boolean,
    ): string {
        const realLineNum = this._scriptLineMap[lineNum]
        const retString = `attribute '${attrName}' (line ${realLineNum + 1})`
        if (caps) {
            return retString[0].toUpperCase() + retString.substring(1)
        }
        return retString
    }

    _removeEmptyLines() {
        for (let i = 0; i < this._scriptSplit.length; i++) {
            const line = this._scriptSplit[i]
            if (line.trim().length !== 0) {
                this._scriptLine.push(line)
                this._scriptLineMap.push(i)
            }
        }
    }

    _parseLineTypes() {
        // line types: symbol definitions, + lines, subclass definition lines,
        // subclass reference lines (multiple inheritance)
        let subclassDefinitionLoc = -1
        for (let i = 0; i < this._scriptLine.length; i++) {
            if (this._lineSymbols[i].hasSymbol) {
                if (subclassDefinitionLoc !== -1) {
                    throw new Error(
                        `${this._lineDisplay(
                            subclassDefinitionLoc,
                            true,
                        )}: non-prefixed lines must be last line in block`,
                    )
                }
                this._lineType.push(LineTypes.SYMBOL_DEFINITION)
                continue
            }
            const line = this._scriptLine[i].trim()
            if (line.startsWith("+")) {
                if (line[1] !== " ") {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: '+' lines must have a space after '+'`,
                    )
                }
                if (i === 0) {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: '+' line cannot be the first line`,
                    )
                }
                if (this._lineOwnedBy[i] !== this._lineOwnedBy[i - 1]) {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: '+' lines must have same whitespace as previous line`,
                    )
                }
                if (
                    !(
                        this._lineType[i - 1] === LineTypes.PLUS ||
                        this._lineType[i - 1] === LineTypes.SYMBOL_DEFINITION ||
                        this._lineType[i - 1] === LineTypes.SUBCLASS_DEFINITION
                    )
                ) {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: '+' lines must be preceded by a symbol definition`,
                    )
                }
                this._lineType.push(LineTypes.PLUS)
            } else if (line.startsWith("[") && line.endsWith("]")) {
                if (subclassDefinitionLoc !== -1) {
                    throw new Error(
                        `${this._lineDisplay(
                            subclassDefinitionLoc,
                            true,
                        )}: non-prefixed lines must be last line in block`,
                    )
                }
                if (this._lineOwnedBy[i] === -1) {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: subclass reference lines must be owned by an entity`,
                    )
                }
                this._lineType.push(LineTypes.SUBCLASS_REFERENCE)
            } else {
                if (subclassDefinitionLoc !== -1) {
                    throw new Error(
                        `${this._lineDisplay(
                            subclassDefinitionLoc,
                            true,
                        )}: non-prefixed lines must be last line in block`,
                    )
                }
                if (this._lineOwnedBy[i] === -1) {
                    throw new Error(
                        `${this._lineDisplay(
                            i,
                            true,
                        )}: non-prefixed lines must be owned by an entity`,
                    )
                }
                subclassDefinitionLoc = i
                this._lineType.push(LineTypes.SUBCLASS_DEFINITION)
            }
            if (
                i !== this._lineOwnedBy.length - 1 &&
                this._lineOwnedBy[i + 1] < this._lineOwnedBy[i]
            ) {
                subclassDefinitionLoc = -1
            }
        }
    }

    _findMatchingBracket(line: string, start: number, end: number): number {
        let bracketCount = 0
        for (let i = start; i < end; i++) {
            const char = line[i]
            if (char === "{") {
                bracketCount++
            } else if (char === "}") {
                bracketCount--
            }
            if (bracketCount === -1) {
                return i
            }
        }
        return -1
    }

    _parseAndValidateEntityAttributes(
        line: string,
        lineNum: number,
        start?: number,
        end?: number,
        attrNameSet?: Set<string>,
    ): [number, Attribute[]] {
        function addAttribute(parser: Parser): void {
            // add the previous attribute
            if (currName.length === 0) {
                if (isComposite) {
                    throw new Error(
                        `Composite attribute name cannot be empty at ${parser._lineDisplay(
                            currentLineNum,
                            false,
                        )}`,
                    )
                }
                // ignore extra whitespace
                return
            }
            let attrName = currName.join("")
            let isKey = false
            let isList = false
            let isComputed = false
            if (attrName.startsWith("[") && attrName.endsWith("]")) {
                attrName = attrName.substring(1, attrName.length - 1).trim()
                isKey = true
            }
            if (attrName.startsWith("<") && attrName.endsWith(">")) {
                attrName = attrName.substring(1, attrName.length - 1).trim()
                isComputed = true
            }
            if (attrName.endsWith("[]")) {
                attrName = attrName.substring(0, attrName.length - 2).trim()
                isList = true
            }
            if (attrName.length === 0) {
                throw new Error(
                    `Attribute name cannot be empty at ${parser._lineDisplay(
                        currentLineNum,
                        false,
                    )}`,
                )
            }
            if (!attrName.match(/^[a-zA-Z0-9_-]+$/)) {
                throw new Error(
                    `${parser._attributeDisplay(
                        currentLineNum,
                        attrName,
                        true,
                    )} is not valid, should only contain alphanumeric characters, underscores and dashes`,
                )
            }
            if (_attrNameSet.has(attrName)) {
                throw new Error(
                    `${parser._attributeDisplay(
                        currentLineNum,
                        attrName,
                        true,
                    )} is redefined`,
                )
            }
            if (isComposite) {
                attrs.push({
                    name: attrName,
                    isKey: isKey,
                    isList: isList,
                    isComputed: isComputed,
                    isComposite: true,
                    components: compositeChildren,
                })
            } else {
                attrs.push({
                    name: attrName,
                    isKey: isKey,
                    isList: isList,
                    isComputed: isComputed,
                    isComposite: false,
                })
            }
            _attrNameSet.add(attrName)
            currName = []
            isComposite = false
            compositeChildren = []
        }
        // line should be a trimmed string
        let currName: string[] = []
        const attrs: Attribute[] = []
        let isComposite = false
        let compositeChildren: Attribute[] = []
        const _start = start ?? 0
        const _end = end ?? line.length
        const _attrNameSet = attrNameSet ?? new Set()
        let currentLineNum = lineNum
        for (let i = _start; i < _end; i++) {
            const char = line[i]
            if (char === "{") {
                if (isComposite) {
                    throw new Error(
                        `Multiple '{}' definitions for ${this._attributeDisplay(
                            currentLineNum,
                            currName.join(""),
                            false,
                        )}`,
                    )
                }
                const endIndex = this._findMatchingBracket(line, i + 1, _end)
                if (endIndex === -1) {
                    throw new Error(
                        `Unmatched brace at ${this._lineDisplay(
                            currentLineNum,
                            false,
                        )}`,
                    )
                }
                isComposite = true
                ;[currentLineNum, compositeChildren] =
                    this._parseAndValidateEntityAttributes(
                        line,
                        currentLineNum,
                        i + 1,
                        endIndex,
                        _attrNameSet,
                    )
                if (compositeChildren.length === 0) {
                    throw new Error(
                        `Composite ${this._attributeDisplay(
                            currentLineNum,
                            currName.join(""),
                            false,
                        )} cannot be empty`,
                    )
                }
                i = endIndex
            } else if (char === " " || char === "\n") {
                addAttribute(this)
                currentLineNum += char === "\n" ? 1 : 0
            } else {
                if (isComposite) {
                    throw new Error(
                        `No characters are allowed after a '{}' block at ${this._lineDisplay(
                            currentLineNum,
                            false,
                        )}`,
                    )
                }
                currName.push(char)
            }
        }
        addAttribute(this)
        return [currentLineNum, attrs]
    }

    _mergePlusLines() {
        const lineOwnedByMap: number[] = []
        for (let i = 0; i < this._lineType.length; i++) {
            if (this._lineOwnedBy[i] !== -1) {
                this._lineOwnedBy[i] = lineOwnedByMap[this._lineOwnedBy[i]]
            }
            if (this._lineType[i] === LineTypes.PLUS) {
                this._scriptLineNoSymbolPlusMerged[
                    this._scriptLineNoSymbolPlusMerged.length - 1
                ] += "\n" + this._scriptLineNoSymbol[i].trim().substring(1)
                lineOwnedByMap.push(lineOwnedByMap[i - 1])
            } else {
                this._scriptLineNoSymbolPlusMerged.push(
                    this._scriptLineNoSymbol[i].trim(),
                )
                lineOwnedByMap.push(i)
            }
        }
    }

    _lineToEntity(lineNum: number): Entity | null {
        const symbol = this._lineToSymbol(lineNum)
        if (!symbol) {
            return null
        }
        if (symbol.type === LineEntityTypes.RELATIONSHIP) {
            return null
        }
        const entity = this._entitySymbolsMap.get(symbol.symbol)
        if (!entity) {
            return null
        }
        return entity[1]
    }

    _mainParse() {
        const currentSubclassesStack: Set<Entity>[] = []
        let currentLineNum = 0
        for (let i = 0; i < this._scriptLineNoSymbolPlusMerged.length; i++) {
            // deal with block starts and ends
            if (
                i === 0 ||
                this._lineOwnedBy[currentLineNum] >
                    this._lineOwnedBy[currentLineNum - 1]
            ) {
                // block start, add to subclass stack
                currentSubclassesStack.push(new Set())
            } else if (
                this._lineOwnedBy[currentLineNum] <
                this._lineOwnedBy[currentLineNum - 1]
            ) {
                // block end, pop from subclass stack
                const currentSubclasses = currentSubclassesStack.pop()
                if (!currentSubclasses) {
                    throw new Error(
                        `Internal error: subclass stack is empty at line ${currentLineNum}`,
                    )
                }
                if (currentSubclasses.size > 0) {
                    // add to subclasses of the owning entity
                    const entity = this._lineToEntity(
                        this._lineOwnedBy[currentLineNum - 1],
                    )
                    if (!entity) {
                        throw new Error(
                            `Internal error: entity not found at line ${
                                currentLineNum - 1
                            }`,
                        )
                    }
                    currentSubclasses.forEach((subclass) => {
                        entity.subclassRelationships.push({
                            superclass: entity,
                            subclass: subclass,
                            isDirect: true,
                        })
                    })
                }
            }

            const lineType = this._lineType[currentLineNum]
            switch (lineType) {
                case LineTypes.PLUS:
                    throw new Error(
                        `Internal error: plus lines should have been merged`,
                    )
                case LineTypes.SYMBOL_DEFINITION:
                    const symbol = this._lineSymbols[currentLineNum]
                    if (!symbol.hasSymbol) {
                        throw new Error(
                            `Internal error: symbol not found at line ${currentLineNum}`,
                        )
                    }
                    if (symbol.type === LineEntityTypes.RELATIONSHIP) {
                        const relationship = this._relationshipSymbolsMap.get(
                            symbol.symbol,
                        )
                        if (!relationship) {
                            throw new Error(
                                `Internal error: relationship ${symbol.symbol} somehow not found`,
                            )
                        }
                        if (relationship[0] !== currentLineNum) {
                            throw new Error(
                                `Internal error: line numbers do not match up during final parse - expected ${
                                    (relationship ?? [-1])[0]
                                }, got ${currentLineNum}`,
                            )
                        }
                        const [endLine] = this._parseRelationship(
                            this._scriptLineNoSymbolPlusMerged[i],
                            currentLineNum,
                            relationship[1],
                        )
                        currentLineNum = endLine + 1
                    } else {
                        // handle entity
                        const [endLine, attrs] =
                            this._parseAndValidateEntityAttributes(
                                this._scriptLineNoSymbolPlusMerged[i],
                                currentLineNum,
                            )
                        const entity = this._entitySymbolsMap.get(symbol.symbol)
                        if (!entity) {
                            throw new Error(
                                `Internal error: entity ${symbol.symbol} somehow not found`,
                            )
                        }
                        if (entity[0] !== currentLineNum) {
                            throw new Error(
                                `Internal error: line numbers do not match up during final parse - expected ${
                                    (entity ?? [-1])[0]
                                }, got ${currentLineNum}`,
                            )
                        }
                        if (this._lineOwnedBy[currentLineNum] !== -1) {
                            // check for key attributes
                            for (const attr of attrs) {
                                if (attr.isKey) {
                                    throw new Error(
                                        `${this._attributeDisplay(
                                            currentLineNum,
                                            attr.name,
                                            true,
                                        )} cannot be a key attribute because it is in a subclass entity`,
                                    )
                                }
                            }
                        }
                        entity[1].attributes = attrs
                        currentSubclassesStack[
                            currentSubclassesStack.length - 1
                        ].add(entity[1])
                        currentLineNum = endLine + 1
                    }
                    break
                case LineTypes.SUBCLASS_DEFINITION:
                    const superclass = this._lineToEntity(
                        this._lineOwnedBy[currentLineNum],
                    )
                    if (!superclass) {
                        throw new Error(
                            `Internal error: owning entity not found at line ${currentLineNum}`,
                        )
                    }
                    const [endLine, subclassRelationships] =
                        this._parseSubclassDefinitions(
                            this._scriptLineNoSymbolPlusMerged[i],
                            currentLineNum,
                            superclass,
                            currentSubclassesStack[
                                currentSubclassesStack.length - 1
                            ],
                        )
                    superclass.subclassRelationships.push(
                        ...subclassRelationships,
                    )
                    currentLineNum = endLine + 1
                    break
                case LineTypes.SUBCLASS_REFERENCE:
                    // append to stack
                    const entityName = this._scriptLineNoSymbolPlusMerged[i]
                        .substring(
                            1,
                            this._scriptLineNoSymbolPlusMerged[i].length - 1,
                        )
                        .trim()
                    const entity = this._entitySymbolsMap.get(entityName)
                    if (!entity) {
                        throw new Error(
                            `${this._lineDisplay(
                                currentLineNum,
                                true,
                            )}: entity ${entityName} does not exist`,
                        )
                    }
                    // check for key attributes
                    for (const attr of entity[1].attributes) {
                        if (attr.isKey) {
                            throw new Error(
                                `${this._attributeDisplay(
                                    currentLineNum,
                                    attr.name,
                                    true,
                                )} cannot be a key attribute because it is in a subclass entity`,
                            )
                        }
                    }
                    currentSubclassesStack[
                        currentSubclassesStack.length - 1
                    ].add(entity[1])
                    currentLineNum += 1
            }
        }
        if (this._lineOwnedBy[currentLineNum - 1] > 0) {
            // block end, pop from subclass stack
            const currentSubclasses = currentSubclassesStack.pop()
            if (!currentSubclasses) {
                throw new Error(
                    `Internal error: subclass stack is empty at line ${currentLineNum}`,
                )
            }
            if (currentSubclasses.size > 0) {
                // add to subclasses of the owning entity
                const entity = this._lineToEntity(
                    this._lineOwnedBy[currentLineNum - 1],
                )
                if (!entity) {
                    throw new Error(
                        `Internal error: entity not found at line ${
                            currentLineNum - 1
                        }`,
                    )
                }
                currentSubclasses.forEach((subclass) => {
                    entity.subclassRelationships.push({
                        superclass: entity,
                        subclass: subclass,
                        isDirect: true,
                    })
                })
            }
        }
    }

    _parseSubclassDefinitions(
        line: string,
        lineNum: number,
        superclass: Entity,
        validSubclasses: Set<Entity>,
    ): [number, SubclassRelationship[]] {
        function addSubclassDef(parser: Parser): void {
            const token = currToken.join("")
            if (token.length === 0) {
                return
            }
            if (token.includes("^") && token.includes("|")) {
                throw new Error(
                    `${parser._lineDisplay(
                        currentLineNum,
                        true,
                    )}: conflicting subclass definition, '^' and '|' cannot be used together`,
                )
            }
            let subTokens = [token]
            let disjoint = false
            if (token.includes("^")) {
                subTokens = token.split("^")
                disjoint = true
            } else if (token.includes("|")) {
                subTokens = token.split("|")
            }
            if (subTokens.length === 1) {
                const entity = parser._entitySymbolsMap.get(subTokens[0])
                if (!entity) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${subTokens[0]}' does not exist`,
                    )
                }
                if (!validSubclasses.has(entity[1])) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${
                            subTokens[0]
                        }' is not included in this scope`,
                    )
                }
                subclassRelationships.push({
                    superclass: superclass,
                    subclass: entity[1],
                    isDirect: true,
                })
                seenEntities.add(entity[1])
                return
            }
            const entities = new Set<Entity>()
            let optional = false
            for (const subToken of subTokens) {
                const entity = parser._entitySymbolsMap.get(subToken)
                if (!entity) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${subToken}' does not exist`,
                    )
                }
                if (entity[1] === superclass) {
                    optional = true
                    continue
                }
                if (!validSubclasses.has(entity[1])) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${subToken}' is not included in this scope`,
                    )
                }
                entities.add(entity[1])
                seenEntities.add(entity[1])
            }
            if (entities.size === 0) {
                return // do nothing
            }
            subclassRelationships.push({
                superclass: superclass,
                subclasses: [...entities],
                isDirect: false,
                isDisjoint: disjoint,
                isOptional: optional,
            })
        }

        let currToken: string[] = []
        let currentLineNum = lineNum
        const subclassRelationships: SubclassRelationship[] = []
        const seenEntities = new Set<Entity>()
        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === " " || char === "\n") {
                addSubclassDef(this)
                currToken = []
                currentLineNum += char === "\n" ? 1 : 0
            } else {
                currToken.push(char)
            }
        }
        addSubclassDef(this)
        for (const entity of seenEntities) {
            validSubclasses.delete(entity)
        }
        return [currentLineNum, subclassRelationships]
    }

    _parseRelationship(
        line: string,
        lineNum: number,
        relationship: Relationship,
    ): [number] {
        function parseRelParam(parser: Parser): void {
            const token = currToken.join("")
            if (token.length === 0) {
                return
            }
            if (token.includes(">")) {
                // is an endpoint
                let weak = false
                let partial = false
                if (token.startsWith("-")) {
                    partial = true
                } else if (token.startsWith("*")) {
                    weak = true
                }
                const cardinality = token.charAt(1)
                if (!cardinality.match(/[1A-Za-z]/)) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: invalid endpoint cardinality '${cardinality}'`,
                    )
                }
                if (seenCardinalities.has(cardinality)) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: cardinality '${cardinality}' is already defined`,
                    )
                }
                if (cardinality !== "1") seenCardinalities.add(cardinality)
                let endpointNameField = undefined
                let endpointName = token.substring(2, token.indexOf(">"))
                if (endpointName.length === 0) {
                } else if (
                    !(
                        endpointName.startsWith("(") &&
                        endpointName.endsWith(")")
                    )
                ) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: invalid endpoint name '${endpointName}', should be surrounded by parentheses`,
                    )
                } else {
                    endpointNameField = endpointName.substring(
                        1,
                        endpointName.length - 1,
                    )
                    if (!endpointNameField.match(/^[a-zA-Z0-9_-]+$/)) {
                        throw new Error(
                            `${parser._lineDisplay(
                                currentLineNum,
                                true,
                            )}: invalid endpoint name '${endpointNameField}', should only contain alphanumeric characters, underscores and dashes`,
                        )
                    }
                }
                const entityName = token.substring(token.indexOf(">") + 1)
                const entity = parser._entitySymbolsMap.get(entityName)
                if (!entity) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${entityName}' does not exist`,
                    )
                }
                if (endpointEntities.has(entity[1])) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: entity '${entityName}' is already an endpoint`,
                    )
                }
                relationship.endpoints.push({
                    name: endpointNameField,
                    entity: entity[1],
                    isPartial: partial,
                    letterDefinition: cardinality,
                    isOwning: weak,
                })
                if (weak) {
                    relationship.isOwning = true
                    entity[1].isWeak = true
                }
            } else {
                // is an attribute
                const attrName = token
                if (!attrName.match(/^[a-zA-Z0-9_-]+$/)) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: invalid attribute name '${attrName}', should only contain alphanumeric characters, underscores and dashes`,
                    )
                }
                if (attributeNames.has(attrName)) {
                    throw new Error(
                        `${parser._lineDisplay(
                            currentLineNum,
                            true,
                        )}: attribute '${attrName}' is already defined`,
                    )
                }
                attributeNames.add(attrName)
                relationship.attributes.push({
                    name: attrName,
                    isKey: false,
                    isList: false,
                    isComputed: false,
                    isComposite: false,
                })
            }
        }

        let currToken: string[] = []
        let currentLineNum = lineNum
        const endpointEntities = new Set<Entity>()
        const attributeNames = new Set<string>()
        const seenCardinalities = new Set<string>()
        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === " " || char === "\n") {
                parseRelParam(this)
                currToken = []
                currentLineNum += char === "\n" ? 1 : 0
            } else {
                currToken.push(char)
            }
        }
        parseRelParam(this)
        return [currentLineNum]
    }

    _collectObjects(): [Entity[], Relationship[]] {
        const entities: Entity[] = []
        const relationships: Relationship[] = []
        for (const [_, [__, obj]] of this._entitySymbolsMap.entries()) {
            entities.push(obj)
        }
        for (const [_, [__, obj]] of this._relationshipSymbolsMap.entries()) {
            relationships.push(obj)
        }
        return [entities, relationships]
    }

    getObjects() {
        if (!this.#parsed) {
            throw new Error("Parse the source first")
        }
        return this._collectObjects()
    }

    parse() {
        if (this.#parsed) {
            return
        }
        this._removeEmptyLines()
        this._parseSymbols()
        this._validateSymbolNames()
        this._validateDefinitions()
        this._parseWhitespace()
        this._parseLineTypes()
        this._mergePlusLines()
        this._validateOwnership()
        this._mainParse()
        this.#parsed = true
    }
}
