ace.define("ace/mode/q3_cam_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules;

    var s = function () {
        // Block type definitions
        var blocks = "cameraPathDef|camera_Interpolated|camera_Spline|target_Interpolated|target_Spline|target|event|fov";

        // Internal property identifiers
        var properties = "time|name|startPos|endPos|granularity|type|param";

        var keywordMapper = this.createKeywordMapper({
            "storage.type.q3cam": blocks,
            "support.type.property.q3cam": properties
        }, "identifier", true);

        this.$rules = {
            "start": [
                // Standard single-line engine/tool comments
                { token: "comment", regex: "\\/\/.*$" },
                
                // Multi-line comment blocks
                { token: "comment", regex: "\\/\\*", next: "comment" },

                // Double-quoted strings (e.g. target name strings or param values)
                { token: "string", regex: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' },

                // Spatial coordinate bounds / vector grouping arrays
                { token: "paren.lparen", regex: "\\(" },
                { token: "paren.rparen", regex: "\\)" },

                // Struct and Block opening/closing delimiters
                { token: "paren.lparen", regex: "\\{" },
                { token: "paren.rparen", regex: "\\}" },

                // Positional floats, precise timing boundaries, and negative integers
                { token: "constant.numeric", regex: "(?:-?\\d+(?:\\.\\d*)?|-?\\.\\d+)\\b" },

                // Map words to block definitions or specific properties
                { token: keywordMapper, regex: "\\b[a-zA-Z_][a-zA-Z0-9_]*\\b" }
            ],
            "comment": [
                { token: "comment", regex: "\\*\\/", next: "start" },
                { defaultToken: "comment" }
            ]
        };
        this.normalizeRules();
    };

    r.inherits(s, i);
    t.Q3CamHighlightRules = s;
});

ace.define("ace/mode/q3_cam", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_cam_highlight_rules"], function (e, t, n) {
    "use strict";

    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_cam_highlight_rules").Q3CamHighlightRules;

    var o = function () {
        this.HighlightRules = s;
        this.$behaviour = this.$defaultBehaviour;
    };

    r.inherits(o, i);

    (function () {
        this.lineCommentStart = "//";
        this.blockComment = { start: "/*", end: "*/" };
        this.$id = "ace/mode/q3_cam";
    }).call(o.prototype);

    t.Mode = o;
});

(function () {
    ace.require(["ace/mode/q3_cam"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();