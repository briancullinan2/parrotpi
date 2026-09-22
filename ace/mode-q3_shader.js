ace.define("ace/mode/q3_shader_highlight_rules", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text_highlight_rules").TextHighlightRules,
        s = function () {
            
            // 1. Root Properties & Global Keywords
            const globalDirectives = "cull|sort|tesssize|clampTime|polygonOffset|polygonoffset|entityMergable|" +
                                     "nomipmaps|nopicmip|novlcollapse|nocompress|translucent|twosided|portal|" +
                                     "fogParms|fogparms|light|skyParms|skyparms|palette";

            const conditionals = "if|else|elif";
            const implicitMappings = "implicitMap|implicitMask|implicitBlend";

            // 2. Stage-Specific Keywords
            const stageDirectives = "map|clampmap|animMap|videoMap|blendfunc|blendFunc|rgbGen|alphaGen|tcGen|texgen|" +
                                    "depthfunc|depthFunc|depthwrite|depthFragment|stage|detail|alphaFunc|" +
                                    "specularreflectance|specularexponent|gloss|roughness|parallaxdepth|normalscale|" +
                                    "specularscale";

            // 3. Enumerated Arguments (Used for strict positional matching states)
            const glConstants = "GL_ONE|GL_ZERO|GL_DST_COLOR|GL_SRC_COLOR|GL_ONE_MINUS_DST_COLOR|GL_ONE_MINUS_SRC_COLOR|" +
                                "GL_DST_ALPHA|GL_SRC_ALPHA|GL_ONE_MINUS_DST_ALPHA|GL_ONE_MINUS_SRC_ALPHA";

            const waveFunctions = "sin|square|triangle|sawtooth|inversesawtooth|noise";

            const surfaceParms = "water|slime|lava|playerclip|monsterclip|shotclip|nodrop|nonsolid|origin|trans|detail|" +
                                 "structural|areaportal|antiportal|clusterportal|donotenter|fog|sky|lightfilter|alphashadow|" +
                                 "hint|slick|noimpact|nomarks|ladder|nodamage|metalsteps|flesh|nosteps|nodraw|" +
                                 "pointlight|nolightmap|nodlight|dust|terrain|skip";

            const deformModifiers = "projectionShadow|autosprite|autosprite2|bulge|move|normal|wave|text[0-7]";

            const tcModModifiers = "turb|scale|scroll|stretch|transform|rotate|entityTranslate";

            const generalModifiers = "identity|identityLighting|entity|oneMinusEntity|vertex|exactVertex|vertexLit|" +
                                     "exactVertexLit|lightingDiffuse|oneMinusVertex|lightingSpecular|environment|firstPerson|" +
                                     "lightmap|texture|base|vector|add|filter|blend|gt0|lt128|ge128|lequal|equal|disable|" +
                                     "none|twosided|back|backside|backsided|opaque|decal|seeThrough|banner|additive|nearest|underwater";

            this.$rules = {
                "start": [
                    // Single-line C++ style comments
                    { token: "comment", regex: "\\/\/.*$" },
                    
                    // Main Shader Definition Header / CSS Selection Style
                    { token: "entity.name.tag.shader", regex: "^[a-zA-Z0-9_\\-\\/.\\$]+$" },
                    
                    // Structural Braces
                    { token: "paren.lparen", regex: "{" },
                    { token: "paren.rparen", regex: "}" },

                    // --- STRICT CONTEXTUAL TRANSITIONS (The Secret to Max Parts) ---
                    
                    // Contextual match for 'surfaceParm <value>'
                    {
                        token: ["keyword.control.directive.surfaceparm", "text", "support.constant.surfaceparm"],
                        regex: "\\b(surface[pP]arm)(\\s+)(" + surfaceParms + ")\\b",
                        caseInsensitive: true
                    },
                    // Contextual match for 'deformVertexes <modifier>'
                    {
                        token: ["keyword.control.directive.deform", "text", "support.function.deform.modifier"],
                        regex: "\\b(deform[vV]ertexes)(\\s+)(" + deformModifiers + ")\\b",
                        caseInsensitive: true
                    },
                    // Contextual match for 'tcMod <modifier>'
                    {
                        token: ["keyword.control.directive.tcmod", "text", "support.function.tcmod.modifier"],
                        regex: "\\b(tc[mM]od)(\\s+)(" + tcModModifiers + ")\\b",
                        caseInsensitive: true
                    },
                    // Contextual match for 'map/clampmap <path>' without extensions
                    {
                        token: ["keyword.control.directive.map", "text", "string.path.extensionless"],
                        regex: "\\b(map|clampmap)(\\s+)([a-zA-Z0-9_\\-\\/.]+)\\b",
                        caseInsensitive: true
                    },

                    // --- TOOL AND ASSET VENDOR EXTENSIONS ---
                    { token: "support.variable.vendor.qer", regex: "\\bqer_[a-zA-Z0-9_]+\\b", caseInsensitive: true },
                    { token: "support.variable.vendor.q3map", regex: "\\bq3map_[a-zA-Z0-9_]+\\b", caseInsensitive: true },
                    { token: "support.variable.vendor.q3gl2", regex: "\\bq3gl2_[a-zA-Z0-9_]+\\b", caseInsensitive: true },
                    { token: "support.variable.vendor.darkplaces", regex: "\\b(?:dp_[a-zA-Z0-9_]+|dpoffsetmapping|dpglossexponentmod|dpglossintensitymod|dpreflectcube)\\b", caseInsensitive: true },
                    { token: "support.variable.vendor.xonotic", regex: "\\bxon_nowarn\\b", caseInsensitive: true },

                    // --- STANDALONE FALLBACK MATCHERS ---
                    
                    // Core Controls & Global Directives
                    { token: "keyword.control.global", regex: "\\b(?:" + globalDirectives + ")\\b", caseInsensitive: true },
                    { token: "keyword.control.conditional", regex: "\\b(?:" + conditionals + ")\\b", caseInsensitive: true },
                    { token: "keyword.control.implicit", regex: "\\b(?:" + implicitMappings + ")\\b", caseInsensitive: true },
                    { token: "keyword.control.stage", regex: "\\b(?:" + stageDirectives + ")\\b", caseInsensitive: true },

                    // Standard Asset Filepaths with Extensions
                    { token: "string.path.asset", regex: "\\b[a-zA-Z0-9_\\-\\/.]+\\.(?:tga|jpg|png|pcx)\\b", caseInsensitive: true },

                    // Functional Core Assets / Internal engine resources ($lightmap)
                    { token: "variable.language.engine", regex: "\\$[a-zA-Z0-9_]+" },

                    // Core Blending Constants
                    { token: "constant.language.opengl", regex: "\\b(?:" + glConstants + ")\\b", caseInsensitive: true },

                    // Waveforms
                    { token: "support.function.mathematical", regex: "\\b(?:" + waveFunctions + ")\\b", caseInsensitive: true },

                    // Evaluators and Shared Modifiers Fallback
                    { token: "support.function.modifier", regex: "\\b(?:" + generalModifiers + ")\\b", caseInsensitive: true },
                    { token: "support.constant.surfaceparm.fallback", regex: "\\b(?:" + surfaceParms + ")\\b", caseInsensitive: true },

                    // Conditional Evaluation Operations
                    { token: "keyword.operator.logical", regex: "&&|\\|\\|" },
                    { token: "keyword.operator.comparison", regex: "==|!=|>=|>|<=|<" },

                    // Numeric configurations (floating scalars, vectors)
                    { token: "constant.numeric.shader", regex: "\\b-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)\\b" },

                    // Basic String Literals
                    { token: "string.quoted.double", regex: '"', next: "string" }
                ],
                "string": [
                    { token: "string.quoted.double", regex: '"', next: "start" },
                    { defaultToken: "string.quoted.double" }
                ]
            };
            
            this.normalizeRules();
        };
    r.inherits(s, i), t.Q3ShaderHighlightRules = s;
});

ace.define("ace/mode/q3_shader", ["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/q3_shader_highlight_rules"], function (e, t, n) {
    "use strict";
    var r = e("../lib/oop"),
        i = e("./text").Mode,
        s = e("./q3_shader_highlight_rules").Q3ShaderHighlightRules,
        o = function () {
            this.HighlightRules = s, this.$behaviour = this.$defaultBehaviour;
        };
    r.inherits(o, i), 
    function () {
        this.lineCommentStart = "//";
        this.$id = "ace/mode/q3_shader";
    }.call(o.prototype), t.Mode = o;
});

(function () {
    ace.require(["ace/mode/q3_shader"], function (m) {
        if (typeof module == "object" && typeof exports == "object" && module) {
            module.exports = m;
        }
    });
})();