import Attribute from "./attribute"
import Relationship from "./relationship"
import SubclassRelationship from "./subclassRelationship"

type Entity = {
    name: string
    attributes: Attribute[]
    relationships: Relationship[]
    subclassRelationships: SubclassRelationship[] // relationships where this entity is the superclass
    isWeak: boolean
}

export default Entity
