import Attribute from "./attribute"
import Entity from "./entity"

type RelationshipEndpoint = {
    name?: string // for unary relationships
    entity: Entity
    isPartial: boolean // double/single line
    letterDefinition: string // '1' or 'N', 'M', ...
    isOwning: boolean // for owning relationships
}

type Relationship = {
    name: string
    endpoints: RelationshipEndpoint[]
    attributes: Attribute[]
    isOwning: boolean
}

export default Relationship
