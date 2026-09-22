ace.define("ace/keyboard/combined", ["require", "exports", "module", "ace/keyboard/hash_handler"], function(e, t, n) {
    "use strict";

    var HashHandler = e("../keyboard/hash_handler").HashHandler;
    t.handler = new HashHandler();
    t.handler.$id = "ace/keyboard/combined";

    t.handler.addCommands([
        // --- 1. SAVING ---
        {
            name: "save",
            bindKey: { win: "Ctrl-S", mac: "Command-S" },
            exec: function(editor) {
                if (editor.commands.commands.save) {
                    editor.commands.exec("save", editor);
                } else {
                    console.log("Save triggered");
                }
            },
            readOnly: true
        },
        {
            name: "saveall",
            // Directly mapped to Ctrl+Shift+S (Fixing the annoying Ctrl+K S behavior)
            bindKey: { win: "Ctrl-Shift-S", mac: "Command-Shift-S" },
            exec: function(editor) {
                if (editor.commands.commands.saveall) {
                    editor.commands.exec("saveall", editor);
                } else if (editor.commands.commands.save) {
                    editor.commands.exec("save", editor); // Fallback to normal save
                }
            },
            readOnly: true
        },

        // --- 2. LINE EDITING & MANIPULATION (Sublime/VS Code Best Hits) ---
        {
            name: "copylinesdown",
            bindKey: { win: "Shift-Alt-Down", mac: "Shift-Option-Down" },
            exec: "copylinesdown"
        },
        {
            name: "copylinesup",
            bindKey: { win: "Shift-Alt-Up", mac: "Shift-Option-Up" },
            exec: "copylinesup"
        },
        {
            name: "movelinesdown",
            bindKey: { win: "Alt-Down", mac: "Option-Down" },
            exec: "movelinesdown"
        },
        {
            name: "movelinesup",
            bindKey: { win: "Alt-Up", mac: "Option-Up" },
            exec: "movelinesup"
        },
        {
            name: "removeline",
            bindKey: { win: "Ctrl-Shift-K", mac: "Command-Shift-K" },
            exec: "removeline"
        },
        {
            name: "duplicateSelection",
            bindKey: { win: "Ctrl-Shift-D", mac: "Command-Shift-D" },
            exec: "duplicateSelection"
        },

        // --- 3. COMMENTING ---
        {
            name: "togglecomment",
            bindKey: { win: "Ctrl-/", mac: "Command-/" },
            exec: "togglecomment"
        },
        {
            name: "toggleBlockComment",
            bindKey: { win: "Ctrl-Shift-/", mac: "Command-Option-/" },
            exec: "toggleBlockComment"
        },

        // --- 4. MULTI-CURSOR & SELECTION ---
        {
            name: "selectMoreAfter",
            bindKey: { win: "Ctrl-D", mac: "Command-D" },
            exec: "selectMoreAfter"
        },
        {
            name: "selectMoreBefore",
            bindKey: { win: "Ctrl-Shift-D", mac: "Command-Shift-D" },
            exec: "selectMoreBefore"
        },
        {
            name: "addCursorBelow",
            bindKey: { win: "Ctrl-Alt-Down", mac: "Ctrl-Option-Down" },
            exec: "addCursorBelow"
        },
        {
            name: "addCursorAbove",
            bindKey: { win: "Ctrl-Alt-Up", mac: "Ctrl-Option-Up" },
            exec: "addCursorAbove"
        },

        // --- 5. SEARCH & REPLACE ---
        {
            name: "find",
            bindKey: { win: "Ctrl-F", mac: "Command-F" },
            exec: "find"
        },
        {
            name: "replace",
            bindKey: { win: "Ctrl-H", mac: "Command-H" },
            exec: "replace"
        }
    ]);
});