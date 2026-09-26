ace.define("ace/mode/q3_map_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules;

    var s = function () {
        this.$rules = {
            "start": [
                // Single-line compiler and engine comments (e.g., // brush 0, // entity 0)
                { token: "comment", regex: "\\/\/.*$" },

                // Entity Attribute Assignments: Maps "key" "value" configurations distinctly
                {
                    token: ["variable.parameter.key.q3map", "text", "string.value.q3map"],
                    regex: '("[a-zA-Z0-9_\\-]+")(\\s+)("[^"]*")'
                },

                // Fallback for standalone structural string literals
                { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },

                // Shader / Texture Filepaths (e.g., common/caulk, gothic_floor/metalbridge06)
                { 
                    token: "support.class.texture.q3map", 
                    regex: "\\b[a-zA-Z0-9_\\-]+/[a-zA-Z0-9_\\-/\\.]+\\b" 
                },

                // Numerical definitions (Precision coordinates, texture scale, shifts, rotation flags)
                { token: "constant.numeric", regex: "\\b-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\b" },

                // Delimiters for spatial plane definitions ( X Y Z )
                { token: "punctuation.definition.vector.lparen", regex: "\\(" },
                { token: "punctuation.definition.vector.rparen", regex: "\\)" },

                // Structural Delimiters for Brushes and Entities { ... }
                { token: "paren.lparen", regex: "\\{" },
                { token: "paren.rparen", regex: "\\}" }
            ]
        };
        this.normalizeRules();
    };

    r.inherits(s, i);
    t.Q3MapHighlightRules = s;
});

ace.define("ace/mode/q3_map", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_map_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_map_highlight_rules").Q3MapHighlightRules;

    var o = function () {
        this.HighlightRules = s;
        this.$behaviour = this.$defaultBehaviour;
    };

    r.inherits(o, i);

    (function () {
        this.lineCommentStart = "//";
        this.$id = "ace/mode/q3_map";
    }).call(o.prototype);

    t.Mode = o;
});

(function () {
    ace.require(["ace/mode/q3_map"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();