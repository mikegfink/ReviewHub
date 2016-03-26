// ==UserScript==
// @name         ReviewHub
// @namespace
// @version      0.1
// @description  Modify GitHub pull requests to require approval
// @author       Mike Fink
// @match        https://*.github.com/*/*/pull/*
// @require      http://code.jquery.com/jquery-2.2.1.min.js
// ==/UserScript==
/* jshint -W097 */
'use strict';

const GH_MERGE_BUTTON = '.btn.btn-primary.js-merge-branch-action';
const GH_BRANCH_ACTION_DIV = '.branch-action-item';
const GH_COMMENT_CLASS = '.timeline-comment-wrapper:not(.timeline-new-comment)';
const GH_LINE_COMMENT_DIV = '[id^=diff-for-comment]';
const RH_REVIEWER_LIST_CLASS = 'reviewhub-reviewer-list';
const RH_APPROVAL_STATUS_CLASS = 'reviewhub-approval-status';
const APPROVALS = [
    ':+1:',
    ':shipit:',
    'approve'
];

var Reviewer = function(userId) {
    this.userId = userId;
    this.approved = false;
    //console.log('Task instantiated with id: ' + id);
}

function disableMergeButton() {
    $(GH_MERGE_BUTTON).prop('disabled', true);
}

function enableMergeButton() {
    $(GH_MERGE_BUTTON).prop('disabled', false);
}

function createPRApprovalStatus(reviewers, approvers) {
    var $reviewerListJQuery = updateApproverList(reviewers, approvers);
    var $rhApprovalSpan = $('<h4>Pull request approver status:</h4>');
    var $rhApproverList = $('<ul/>')
        .addClass(RH_REVIEWER_LIST_CLASS)
        .append($reviewerListJQuery);
    var $rhApprovalDiv = $('<div/>')
        .addClass(RH_APPROVAL_STATUS_CLASS)
        .append($rhApprovalSpan)
        .append($rhApproverList);
    $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
}

function getReviewers() {
    return [];
}

function updateApprovers() {
    //console.log($(GH_COMMENT_CLASS));
    $(GH_COMMENT_CLASS).each(function() {
        var $comment = $(this).find('.comment-body.js-comment-body').html();
        var $user = $(this).find('a').attr('href').substr(1);
        //var $userId = $(this).find('a > img').attr('data-user');

        for (i = 0; i < APPROVALS.length; i++) {
            if ($comment.indexOf(APPROVALS[i] >= 0)) {
                for (i = 0; i < reviewers.length; i++) {
                    if (reviewers[i].userId == $user) {
                        reviewers[i].approved == true;
                        break;
                    }
                }
                console.log("Approved: ", $user);
            }
        }
    });
}

function isPRApproved() {
    var isApproved = true;
    for (i = 0; i < reviewers.length; i++) {
        if (reviewers[i].approved == false) {
            isApproved = false;
        }
    }
    return isApproved;
}

var reviewers = [];

$(document).ready(function() {
    reviewers = getReviewers();
    var approvers = updateApprovers();

    createPRApprovalStatus(reviewers, approvers);
    if (isPRApproved(reviewers, approvers)) {
        enableMergeButton();
    } else {
        disableMergeButton();
    }

});
