ace.define("ace/theme/oxidizediron", ["require", "exports", "module", "ace/lib/dom"], function (e, t, n) { 
    t.isDark = !0, 
    t.cssClass = "ace-oxidizediron", 
    t.cssText = ".ace-oxidizediron .ace_gutter {color: #78716c;background: #2d2d2d;}.ace-oxidizediron .ace_print-margin {width: 1px;background: #1c1917;}.ace-oxidizediron {background-color: #1a1a1a;color: #d6d3d1;}.ace-oxidizediron .ace_cursor {color: #f5f5f4;}.ace-oxidizediron .ace_marker-layer .ace_active-line {background: rgba(120, 113, 108, 0.08);}.ace-oxidizediron .ace_marker-layer .ace_selection {background: rgba(120, 113, 108, 0.20);}.ace-oxidizediron .ace_keyword {color: #b45309;}.ace-oxidizediron .ace_string {color: #ca8a04;}.ace-oxidizediron .ace_comment {color: #78716c;}.ace-oxidizediron .ace_constant.ace_numeric {color: #78350f;}.ace-oxidizediron .ace_entity.ace_name.ace_function {color: #e7e5e4;}", 
    t.$selectionColorConflict = !0; 
    
    // Fixed: changed "../dom" to "../lib/dom"
    var r = e("../lib/dom"); 
    r.importCssString(t.cssText, t.cssClass, !1) 
}); 

(function () { 
    ace.require(["ace/theme/oxidizediron"], function (m) { 
        if (typeof module == "object" && typeof exports == "object" && module) { 
            module.exports = m; 
        } 
    }) 
})();