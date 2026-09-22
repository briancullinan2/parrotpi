

let activeEditor = null
function PipelineManager(options) {
    options = options || {};

    // TODO:
    //this.clear = clear.bind(this, session)
    if (!window.annotations)
        window.annotations = this
    else
        console.log("[Annotations] You don't need more than one of these.")

    return this
}

PipelineManager.prototype.clear = clear
PipelineManager.prototype.mergeTokens = mergeTokens
PipelineManager.prototype.syncTokensToAce = syncTokensToAce
PipelineManager.prototype.handleWorkerAnnotate = handleWorkerAnnotate
PipelineManager.prototype.refreshActiveEditorView = refreshActiveEditorView

// Context bindings
PipelineManager.prototype.setEditor = function (editor) {
    activeEditor = editor;
}
PipelineManager.prototype.setFileAnnotations = function (session, key, list) {
    session.fileAnnotationsMap[key] = list;
}
PipelineManager.prototype.getState = function () {
    return state;
}

/**
 * Completely purges all highlighting, markers, and annotations from the editor
 */
function clear(session) {
    session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();

    // Remove active visual line highlights
    if (!session.activeMarkerIds) {
        session.activeMarkerIds = []
    }
    session.activeMarkerIds.forEach(function (markerId) {
        session.removeMarker(markerId);
    });
    session.activeMarkerIds = [];
    session.workerAnnotations = [];
    session.fileAnnotationsMap = { system: [] };
    session.tokenCache = [];

    // Clear gutter panels
    session.clearAnnotations()
    session.setAnnotations([]);

    // Reset Ace's background layout tokens
    if (session.bgTokenizer) {
        session.bgTokenizer.lines = [];
        session.bgTokenizer.fireUpdateEvent(0, 0);
    }
}

/**
 * Merges incoming token adjustments into the existing cache on a per-line basis
 * Perfect for partial worker delta updates
 */
function mergeTokens(session, newLinesMap, startRow, endRow) {
    startRow = startRow !== undefined ? startRow : 0;
    endRow = endRow !== undefined ? endRow : Object.keys(newLinesMap).length - 1;

    let keys = Object.keys(newLinesMap);
    for (let i = 0; i < keys.length; i++) {
        let row = parseInt(keys[i], 10);
        if (row >= startRow && row <= endRow) {
            session.tokenCache[row] = newLinesMap[row];
        }
    }

    syncTokensToAce(startRow, endRow);
}
/**
 * Flushes the local state cache out to the active Ace session viewport
 */
function syncTokensToAce(session, startRow, endRow) {
    session ||= session || activeEditor?.getSession() || aceEditor?.getSession() || ace?.getSession();
    if (!session || !session.tokenCache.length) return;

    if (session.bgTokenizer) {
        // Overwrite Ace's target cache window directly
        session.bgTokenizer.lines = session.tokenCache;

        let lastRow = endRow !== undefined ? endRow : session.tokenCache.length - 1;

        session.bgTokenizer.fireUpdateEvent(startRow || 0, lastRow);

        // CRITICAL FIX: Ace expects 'first' and 'last', NOT 'firstRow' and 'lastRow'
        session._emit("tokenizerUpdate", {
            data: {
                first: startRow || 0,
                last: lastRow
            }
        });
    }
}



