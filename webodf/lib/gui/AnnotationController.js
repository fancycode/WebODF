/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global runtime, core, gui, odf, ops, Node*/

/**
 * @constructor
 * @implements {core.Destroyable}
 * @param {!ops.Session} session
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!string} inputMemberId
 */
gui.AnnotationController = function AnnotationController(session, sessionConstraints, inputMemberId) {
    "use strict";

    var odtDocument = session.getOdtDocument(),
        isAnnotatable = false,
        eventNotifier = new core.EventNotifier([gui.AnnotationController.annotatableChanged]),
        odfUtils = new odf.OdfUtils();

    /**
     * @return {undefined}
     */
    function updatedCachedValues() {
        var cursor = odtDocument.getCursor(inputMemberId),
            cursorNode = cursor && cursor.getNode(),
            newIsAnnotatable = false;
        if (cursorNode) {
            newIsAnnotatable = !odfUtils.isWithinAnnotation(cursorNode, odtDocument.getRootNode());
        }

        if (newIsAnnotatable !== isAnnotatable) {
            isAnnotatable = newIsAnnotatable;
            eventNotifier.emit(gui.AnnotationController.annotatableChanged, isAnnotatable);
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorAdded(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!string} memberId
     * @return {undefined}
     */
    function onCursorRemoved(memberId) {
        if (memberId === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorMoved(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updatedCachedValues();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isAnnotatable = function () {
        return isAnnotatable;
    };

    /**
     * Adds an annotation to the document based on the current selection
     * @return {undefined}
     */
    this.addAnnotation = function () {
        var op = new ops.OpAddAnnotation(),
            selection = odtDocument.getCursorSelection(inputMemberId),
            length = selection.length,
            position = selection.position;

        if (!isAnnotatable) {
            return;
        }

        position = length >= 0 ? position : position + length;
        length = Math.abs(length);

        op.init({
            memberid: inputMemberId,
            position: position,
            length: length,
            name: inputMemberId + Date.now()
        });
        session.enqueue([op]);
    };


    /**
     * @param {!Element} annotationNode
     * @return {undefined}
     */
    this.removeAnnotation = function(annotationNode) {
        var startStep, endStep, op, moveCursor,
            currentUserName = odtDocument.getMember(inputMemberId).getProperties().fullName;

        if (sessionConstraints.getState("edit.annotations.onlyDeleteOwn") === true) {
            if (currentUserName !== odfUtils.getAnnotationCreator(annotationNode)) {
                return;
            }
        }

        // (annotationNode, 0) will report as the step just before the first step in the annotation node
        // Add 1 to this to actually get *within* the annotation
        startStep = odtDocument.convertDomPointToCursorStep(annotationNode, 0) + 1;
        // Will report the last walkable step within the annotation
        endStep = odtDocument.convertDomPointToCursorStep(annotationNode, annotationNode.childNodes.length);

        op = new ops.OpRemoveAnnotation();
        op.init({
            memberid: inputMemberId,
            position: startStep,
            length: endStep - startStep
        });
        moveCursor = new ops.OpMoveCursor();
        moveCursor.init({
            memberid: inputMemberId,
            position: startStep > 0 ? startStep - 1 : startStep, // Last position just before the annotation starts
            length: 0
        });
        session.enqueue([op, moveCursor]);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function(callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorAdded, onCursorAdded);
        odtDocument.unsubscribe(ops.Document.signalCursorRemoved, onCursorRemoved);
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorMoved);
        callback();
    };

    function init() {
        sessionConstraints.registerConstraint("edit.annotations.onlyDeleteOwn");

        odtDocument.subscribe(ops.Document.signalCursorAdded, onCursorAdded);
        odtDocument.subscribe(ops.Document.signalCursorRemoved, onCursorRemoved);
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorMoved);
        updatedCachedValues();
    }

    init();
};

/**@const*/gui.AnnotationController.annotatableChanged = "annotatable/changed";
