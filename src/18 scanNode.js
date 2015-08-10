function scanNodeList(parent, vmodels) {
    var nodes = avalon.slice(parent.childNodes)
    scanNodeArray(nodes, vmodels)
}
var renderedCallbacks= []
function scanNodeArray(nodes, vmodels) {
    for (var i = 0, node; node = nodes[i++];) {
        switch (node.nodeType) {
        case 1:
            scanTag(node, vmodels) //扫描元素节点
            if(renderedCallbacks.length){
                while(fn = renderedCallbacks.pop()){
                    fn.call(node)
                }
            }
            break
        case 3:
            if (rexpr.test(node.nodeValue)) {
                scanText(node, vmodels, i) //扫描文本节点
            }
            break
        }
    }
    
}
