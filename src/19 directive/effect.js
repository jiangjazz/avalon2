avalon.directive("effect", {
    priority: 5,
    init: function (binding) {
        var text = binding.expr,
                className,
                rightExpr
        var colonIndex = text.replace(rexprg, function (a) {
            return a.replace(/./g, "0")
        }).indexOf(":") //取得第一个冒号的位置
        if (colonIndex === -1) { // 比如 ms-class="aaa bbb ccc" 的情况
            className = text
            rightExpr = true
        } else { // 比如 ms-class-1="ui-state-active:checked" 的情况
            className = text.slice(0, colonIndex)
            rightExpr = text.slice(colonIndex + 1)
        }
        if (!rexpr.test(text)) {
            className = JSON.stringify(className)
        } else {
            className = stringifyExpr(className)
        }
        binding.expr = "[" + className + "," + rightExpr + "]"
    },
    update: function (arr) {
        var name = arr[0]
        var elem = this.element
        if (elem.getAttribute("data-effect-name") === name) {
            return
        } else {
            elem.removeAttribute("data-effect-driver")
        }
        var inlineStyles = elem.style
        var computedStyles = window.getComputedStyle ? window.getComputedStyle(elem) : null
        var useAni = false
        if (computedStyles && (supportTransition || supportAnimation)) {

            //如果支持CSS动画
            var duration = inlineStyles[transitionDuration] || computedStyles[transitionDuration]
            if (duration && duration !== '0s') {
                elem.setAttribute("data-effect-driver", "t")
                useAni = true
            }

            if (!useAni) {

                duration = inlineStyles[animationDuration] || computedStyles[animationDuration]
                if (duration && duration !== '0s') {
                    elem.setAttribute("data-effect-driver", "a")
                    useAni = true
                }

            }
        }

        if (!useAni) {
            if (avalon.effects[name]) {
                elem.setAttribute("data-effect-driver", "j")
                useAni = true
            }
        }
        if (useAni) {
            elem.setAttribute("data-effect-name", name)
        }
    }
})

avalon.effects = {}
avalon.effect = function (name, callbacks) {
    avalon.effects[name] = callbacks
}



var supportTransition = false
var supportAnimation = false

var transitionEndEvent
var animationEndEvent
var transitionDuration = avalon.cssName("transition-duration")
var animationDuration = avalon.cssName("animation-duration")
new function () {
    var checker = {
        'TransitionEvent': 'transitionend',
        'WebKitTransitionEvent': 'webkitTransitionEnd',
        'OTransitionEvent': 'oTransitionEnd',
        'otransitionEvent': 'otransitionEnd'
    }
    var tran
    //有的浏览器同时支持私有实现与标准写法，比如webkit支持前两种，Opera支持1、3、4
    for (var name in checker) {
        if (window[name]) {
            tran = checker[name]
            break;
        }
        try {
            var a = document.createEvent(name);
            tran = checker[name]
            break;
        } catch (e) {
        }
    }
    if (typeof tran === "string") {
        supportTransition = true
        transitionEndEvent = tran
    }

    //大致上有两种选择
    //IE10+, Firefox 16+ & Opera 12.1+: animationend
    //Chrome/Safari: webkitAnimationEnd
    //http://blogs.msdn.com/b/davrous/archive/2011/12/06/introduction-to-css3-animat ions.aspx
    //IE10也可以使用MSAnimationEnd监听，但是回调里的事件 type依然为animationend
    //  el.addEventListener("MSAnimationEnd", function(e) {
    //     alert(e.type)// animationend！！！
    // })
    checker = {
        'AnimationEvent': 'animationend',
        'WebKitAnimationEvent': 'webkitAnimationEnd'
    }
    var ani;
    for (var name in checker) {
        if (window[name]) {
            ani = checker[name];
            break;
        }
    }
    if (typeof ani === "string") {
        supportTransition = true
        animationEndEvent = ani
    }

}




var effectPool = []//重复利用动画实例
function effectFactory(el) {
    if (!el || el.nodeType !== 1 || !el.getAttribute("data-effect-name")) {
        return null
    }
    var name = el.getAttribute("data-effect-name")
    var driver = el.getAttribute("data-effect-driver")
    var instance = effectPool.pop() || new Effect()
    instance.el = el
    instance.driver = driver
    instance.useCss = driver !== "j"
    instance.name = name
    instance.callbacks = avalon.effects[name] || {}

    return instance


}

function Effect() {}// 动画实例,做成类的形式,是为了共用所有原型方法

Effect.prototype = {
    contrustor: Effect,
    enterClass: function () {
        return getEffectClass(this, "enter")
    },
    leaveClass: function () {
        return getEffectClass(this, "leave")
    },
    enter: function (before, after) {
        if (document.hidden) {
            return
        }
        var me = this
        var el = me.el
        callEffectHook(me, "beforeEnter")
        before(el) //  这里可能做插入DOM树的操作,因此必须在修改类名前执行

        if (me.useCss) {
            var curEnterClass = me.enterClass()
            //注意,css动画的发生有几个必要条件
            //1.定义了时长,2.有要改变的样式,3.必须插入DOM树 4.display不能等于none
            //5.document.hide不能为true, 6transtion必须延迟一下才修改样式

            me.update = function () {
                var eventName = me.driver === "t" ? transitionEndEvent : animationEndEvent

                el.addEventListener(eventName, function fn() {
                    el.removeEventListener(eventName, fn)
                    if (me.driver === "a") {
                        avalon(el).removeClass(curEnterClass)
                    }
                    callEffectHook(me, "afterEnter")
                    after && after(el)
                    me.dispose()
                })
                if (me.driver === "t") {//transtion延迟触发
                    avalon(el).removeClass(curEnterClass)
                }
            }

            avalon(el).addClass(curEnterClass)//animation会立即触发
            buffer.render(true)
            buffer.queue.push(me)

        } else {
            callEffectHook(this, "enter", function () {
                callEffectHook(me, "afterEnter")
                after && after(el)
                me.dispose()
            })
        }
    },
    leave: function (before, after) {
        if (document.hidden) {
            return
        }

        var me = this
        var el = me.el

        callEffectHook(me, "beforeLeave")
        if (me.useCss) {
            var curLeaveClass = me.leaveClass()
            this.update = function () {
                var eventName = me.driver === "t" ? transitionEndEvent : animationEndEvent
                el.addEventListener(eventName, function fn() {
                    el.removeEventListener(eventName, fn)
                    before(el) //这里可能做移出DOM树操作,因此必须位于动画之后
                    avalon(el).removeClass(curLeaveClass)
                    callEffectHook(me, "afterLeave")
                    after && after(el)
                    me.dispose()
                })

            }

            avalon(el).addClass(curLeaveClass)//animation立即触发
            buffer.render(true)
            buffer.queue.push(me)


        } else {
            callEffectHook(me, "leave", function () {
                before(el)
                callEffectHook(me, "afterLeave")
                after && after(el)
                me.dispose()
            })
        }

    },
    dispose: function () {//销毁与回收到池子中
        this.upate = this.el = this.driver = this.useCss = this.callbacks = null
        if (effectPool.unshift(this) > 100) {
            effectPool.pop()
        }
    }


}


function getEffectClass(instance, type) {
    var a = instance.callbacks[type + "Class"]
    if (typeof a === "string")
        return a
    if (typeof a === "function")
        return a
    return instance.name + "-" + type
}


function callEffectHook(effect, name, cb) {
    var hook = effect.callbacks[name]
    if (hook) {
        hook.call(effect, effect.el, cb)
    }
}

var applyEffect = function (el, dir, before, after) {
    var effect = effectFactory(el)
    if (!effect) {
        before()
        if (after) {
            after()
        }
        return false
    } else {
        var method = dir ? 'enter' : 'leave'
        effect[method](before, after)
    }
}

avalon.mix(avalon.effect, {
    apply: applyEffect,
    //下面这4个方法还有待商讨
    append: function (el, parent, after) {
        return applyEffect(el, 1, function () {
            parent.appendChild(el)
        }, after)
    },
    before: function (el, target, after) {
        return applyEffect(el, 1, function () {
            target.parentNode.insertBefore(el, target)
        }, after)
    },
    remove: function (el, parent, after) {
        return applyEffect(el, 0, function () {
            parent.removeChild(el)
        }, after)
    },
    move: function (el, otherParent, after) {
        return applyEffect(el, 0, function () {
            otherParent.appendChild(el)
        }, after)
    }
})
