import Parser from "erml/parser"
import objectsToGraphviz from "erml/graphviz/converter"

for await (const line of console) {
    const script = await Bun.file(line).text()
    const parser = new Parser(script)
    parser.parse()
    const objects = parser.getObjects()
    console.log(objectsToGraphviz(objects))
    break
}

