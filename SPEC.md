# ERML
*The EER diagram markup language*

## Introduction
ERML is a markup language for describing entity-relationship diagrams, **including IS-A (subclass) relationships**. It is built for **Chen's Notation**.\
ERML files compile to [graphviz](https://graphviz.org/) which can then be used to generate images of the diagram.

## Specs
An ERML file has the extension `.erd`. It is a text file.

### Entity
An entity is defined by a name and then a colon. This is then followed by a space-separated list of attributes.
```
Entity: (attributes)
```

#### Attribute
An attribute is defined by a name. There are a few types of attributes:
- **Simple attribute**: The name is just the name (e.g. `name`)
- **Key attribute**: Surround the name with square brackets (e.g. `[id]`)
- **Derived attribute**: Surround the name with angle brackets (e.g. `<price-with-tax>`)
- **List attribute**: The name ends with square brackets (e.g. `skills[]`)
- **Composite attribute**: The name ends with curly braces; put further attributes within the curly braces. (e.g. `name{firstname lastname <fullname>}`)

You can combine these: here are a few examples:
- **List composite attribute**: `skills[]{name level}`
- **Derived key attribute**: `[<id>]`
- **Derived list attribute**: `<skills[]>`
- **Derived list composite attribute**: `<skills[]>{name level}`

### Relationship
A relationship is defined by a name in angle brackets and then a colon. This is then followed by a space-separated list of attributes and endpoints. **Note the attributes within a relationship can only be simple attributes.**
```
<Relationship>: (endpoints) (attributes)
```

#### Relationship Endpoint
A relationship endpoint is defined to look like an arrow, for example `-1>Entity`. 
1. The first character must be `-`, `=`, or `*` &mdash; `-` defines *partial participation*, `=` defines *total participation*, and `*` defines that *this endpoint is to a weak entity* (marked as total participation by default).
2. The second character is either `1` or any alphabetical character, defining the cardinality.
3. A name may optionally be provided within brackets after the cardinality.
4. This is followed by a `>` character.
5. Finally, the name of the entity is provided.

A few examples of this syntax:
- `-1>Entity` &mdash; Partial participation, cardinality of 1, no name
- `-1(owner)>Entity` &mdash; Partial participation, cardinality of 1, name of `owner`
- `*N>Weak` &mdash; Owning relationship of weak entity

### IS-A/Subclass Relationship
Subclasses are defined like entities in an indented area after a main entity definition:
```
Entity: (attributes)
    Subclass: (attributes)
```
Their syntax is exactly the same as entities, except key attributes are disallowed.

#### Subclass Reference
You can also refer to another class defined elsewhere as a subclass of an entity:
```
Subclass: (attributes)
Entity: (attributes)
    [Subclass]
```
This is equivalent to the example above. This syntax is handy for multiple inheritance.

#### Subclass Definition
This line must be the last line of the indented area. It defines how the subclasses interact.
It can be omitted, in which case every subclass is directly connected to the parent.
Let's say we have the following:
```
Entity:
    A:
    B:
    C:
```
To define a disjoint total specialisation of Entity into A and B, and a overlapping partial specialisation of Entity into B and C, we would write:
```
Par:
    A:
    B:
    C:
    A^B B|C|Par
```
Basically, use `^` for disjoint and `|` for overlapping. Separate groups with spaces; add the parent's name to define an optional specialisation. Any remaining undefined relations will be separately added to the parent.

### `+` Lines
Use `+` to split a long line into pieces:
```
Entity: (attributes)
+ (more attributes)
+ (more attributes)
```
They are interpreted like spaces.