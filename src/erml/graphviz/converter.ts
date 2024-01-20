import Attribute from "erml/types/attribute"
import Entity from "../types/entity"
import Relationship from "../types/relationship"

function attributesToNodesEdges(
    attributes: Attribute[],
    parentName: string,
    isWeak: boolean,
    counter: { num: number },
): string[] {
    const instructions: string[] = []
    for (const attribute of attributes) {
        const nodeName = `${parentName}.${attribute.name}`
        const nodeAttributes = ["shape=ellipse"]
        const label = attribute.name
        if (attribute.isKey) {
            if (isWeak) {
                // use unicode macron below
                nodeAttributes.push(
                    `label="${label.split("").join("\u0331") + "\u0331"}"`,
                )
            } else {
                nodeAttributes.push("label=<<u>" + label + "</u>>")
            }
        } else {
            nodeAttributes.push(`label="${label}"`)
        }
        if (attribute.isComputed) {
            nodeAttributes.push("style=dashed")
        }
        if (attribute.isList) {
            nodeAttributes.push("peripheries=2")
        }
        if (attribute.isComposite) {
            instructions.push(
                ...attributesToNodesEdges(
                    attribute.components,
                    nodeName,
                    isWeak,
                    counter,
                ),
            )
            instructions.push(`"${nodeName}" [${nodeAttributes.join(",")}]`)
            instructions.push(`"${parentName}" -- "${nodeName}"`)
        } else {
            instructions.push(`"${nodeName}" [${nodeAttributes.join(",")}]`)
            instructions.push(`"${parentName}" -- "${nodeName}"`)
        }
    }
    return instructions
}

function objectsToGraphviz(objects: [Entity[], Relationship[]]): string {
    const entities = objects[0]
    const relationships = objects[1]

    const instructions: string[] = [
        "overlap=false",
        "splines=true",
        "nodesep=0.5",
        "K=0.2",
    ]
    const counter = { num: 0 }

    // process all entities
    entities.forEach((entity) => {
        const nodeAttributes = ["shape=box", `label="${entity.name}"`]
        if (entity.isWeak) nodeAttributes.push("peripheries=2")
        
        instructions.push(`subgraph cluster${counter.num++} {`)
        instructions.push("style=invis")
        instructions.push("K=0.05")
        instructions.push(`"${entity.name}" [${nodeAttributes.join(",")}]`)

        // attributes
        instructions.push(
            ...attributesToNodesEdges(
                entity.attributes,
                entity.name,
                entity.isWeak,
                counter,
            ),
        )
        instructions.push("}")

        // subclass relationships
        for (const subclassRelationship of entity.subclassRelationships) {
            if (subclassRelationship.isDirect) {
                instructions.push(
                    `"${subclassRelationship.superclass.name}" -- "${subclassRelationship.subclass.name}" [arrowtail=icurve, dir=back]`,
                )
            } else {
                // make the 'o' or 'd' node
                const nodeAttributes = [
                    "shape=circle",
                    "fixedsize=true",
                    "width=0.3",
                    "height=0.3",
                ]
                if (subclassRelationship.isDisjoint) {
                    nodeAttributes.push("label=d")
                } else {
                    nodeAttributes.push("label=o")
                }

                instructions.push(
                    `".${counter.num}" [${nodeAttributes.join(",")}]`,
                )
                // subclass arrows
                subclassRelationship.subclasses.forEach((subclass) => {
                    instructions.push(
                        `"${subclass.name}"`
                    )
                    instructions.push(
                        `".${counter.num}" -- "${subclass.name}" [arrowtail=icurve, dir=back]`,
                    )
                })
                // superclass arrow
                instructions.push(
                    `"${subclassRelationship.superclass.name}"`
                )
                let inst = `"${subclassRelationship.superclass.name}" -- ".${counter.num}"`
                if (!subclassRelationship.isOptional) {
                    // double line
                    inst += ' [color="black:black"]'
                }
                instructions.push(inst)
                counter.num++
            }
        }
    })

    // relationships
    relationships.forEach((relationship) => {
        const nodeAttributes = ["shape=diamond", `label="${relationship.name}"`]
        if (relationship.isOwning) nodeAttributes.push("peripheries=2")
        instructions.push(`subgraph cluster${counter.num++} {`)
        instructions.push("style=invis")
        instructions.push("K=0.05")
        instructions.push(
            `"${relationship.name}" [${nodeAttributes.join(",")}]`,
        )
        // attributes
        instructions.push(
            ...attributesToNodesEdges(
                relationship.attributes,
                relationship.name,
                false,
                counter,
            ),
        )
        instructions.push("}")
        const unaryDirections = ["n", "s", "e", "w"]
        for (const endpoint of relationship.endpoints) {
            const edgeAttributes = [`taillabel="${endpoint.letterDefinition}"`]
            if (!endpoint.isPartial || endpoint.isOwning) {
                edgeAttributes.push('color="black:black"')
            }
            if (endpoint.name) {
                edgeAttributes.push(`label="${endpoint.name}"`)
                // separate unary splines
                instructions.push(
                    `"${relationship.name}":${unaryDirections.pop()} -- "${
                        endpoint.entity.name
                    }" [${edgeAttributes.join(",")}]`,
                )
            } else {
                instructions.push(
                    `"${relationship.name}" -- "${
                        endpoint.entity.name
                    }" [${edgeAttributes.join(",")}]`,
                )
            }
        }
    })

    return `graph {\n${instructions.join("\n")}\n}`
}

export default objectsToGraphviz
