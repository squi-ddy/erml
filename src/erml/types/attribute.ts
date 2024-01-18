type SingleAttribute = {
    name: string
    isKey: boolean
    isList: boolean
    isComputed: boolean
    isComposite: false
}

type CompositeAttribute = {
    name: string
    isKey: boolean
    isList: boolean
    isComputed: boolean
    isComposite: true
    components: Attribute[]
}

// additional restriction: a list cannot be a key
// a composite attribute cannot be a list (please use an entity + a relationship)
// nesting is as such: [x] outside, <x> next, x{}, then x[] innermost
// so [<x>] is a primary computed value
// and <x[]> is a computed list

type Attribute = SingleAttribute | CompositeAttribute

export default Attribute
