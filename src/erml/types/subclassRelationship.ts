import Entity from "./entity"

type MultiSubclassRelationship = {
    superclass: Entity
    subclasses: Entity[]
    isDirect: false
    isDisjoint: boolean // d or o
    isOptional: boolean // single or double line
}

type SingleSubclassRelationship = {
    superclass: Entity
    subclass: Entity
    isDirect: true
}

// disjoint: ^
// overlapping: |

type SubclassRelationship = MultiSubclassRelationship | SingleSubclassRelationship

export default SubclassRelationship
