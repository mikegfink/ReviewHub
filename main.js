// ==UserScript==
// @name         ReviewHub
// @namespace
// @version      0.1
// @description  Modify GitHub pull requests to require approval
// @author       Mike Fink
// @match        https://*.github.com/*/*
// @require      http://code.jquery.com/jquery-2.2.1.min.js
// ==/UserScript==
/* jshint -W097 */
'use strict';
// /*/pull/*

const GH_TITLE_DIV = '.entry-title strong';
const GH_MAIN_DIV = '.main-content';
const GH_PR_NUM = '.gh-header-number';
const GH_MERGE_BUTTON = '.btn.btn-primary.js-merge-branch-action';
const GH_DISCUSSION_DIV = '.discussion-timeline';
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

var Reviewer = function(userId, kind) {
    this.userId = userId;
    this.kind = kind;
    this.approved = false;
    //console.log('Task instantiated with id: ' + id);
};

function disableMergeButton() {
    $(GH_MERGE_BUTTON).prop('disabled', true);
}

function enableMergeButton() {
    $(GH_MERGE_BUTTON).prop('disabled', false);
}

function createPRApprovalStatus() {
    var $reviewerListJQuery = getApproverList();
    var $rhApprovalSpan = $('<h4>Pull request approver status:</h4>');
    var $rhApproverList = $('<ul style="list-style-type:none"/>')
        .addClass(RH_REVIEWER_LIST_CLASS)
        .append($reviewerListJQuery);
    var $rhApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
    if ($rhApprovalDiv.length === 0) {
        $rhApprovalDiv = $('<div/>')
            .addClass(RH_APPROVAL_STATUS_CLASS)
            .append($rhApprovalSpan)
            .append($rhApproverList);
        //console.log('New div', $rhApprovalDiv);
    } else {
        $rhApprovalDiv.empty()
            .append($rhApprovalSpan)
            .append($rhApproverList);
        //console.log('Updating', $rhApprovalDiv);
    }
    return $rhApprovalDiv;
}

function getApproverList() {
    var lis = "";
    for (var i = 0; i < reviewers.length; i++) {
        var checked = reviewers[i].approved ? "checked" : "unchecked";
        lis += "<li><input type='checkbox' disabled " + checked + "> " +
                reviewers[i].userId + "</li>";
    }
    return lis;
}

function getFiles() {

    var repoName = $(GH_TITLE_DIV).find('a').attr('href').substr(1);
    var prNum = $(GH_PR_NUM).text().substr(1);
    var url = 'https://api.github.com/repos/' + repoName + '/pulls/' + prNum + '/files';
    console.log('Url', url);
}

function updateCommentReviewers($comments) {
    //console.log($comments);
    var anyReviewers = false;
    $comments.each(function() {
        var $comment = $(this).find('.comment-body.js-comment-body');
        var $reviewer = $comment.find('.user-mention');//.attr('innerText').substr(1);
        console.log($reviewer);
        if ($reviewer.length > 0) {
            var userName = $reviewer.text().substr(1);
            if ($comment.text().indexOf(userName + '%') >= 0) {
                anyReviewers = true;
                var newReviewer = true;
                for (var i = 0; i < reviewers.length; i++) {
                    if (reviewers[i].userId == userName) {
                        newReviewer = false;
                    }
                }
                if (newReviewer) {
                    //console.log("Adding new reviewer", userName);
                    reviewers.push(new Reviewer(userName, 'comment'));
                }
            }
        }
    });
    if (!anyReviewers) {
        console.log('No reviewers');
        var i = reviewers.length;
        while (i--) {
            if (reviewers[i].kind === 'comment') {
                reviewers.splice(i, 1);
            }
        }
    }
}

function updateApprovers($comments) {
    var reviewerChange = false;
    $comments.each(function() {
        var comment = $(this).find('.comment-body.js-comment-body').html();
        //console.log('Comment', comment);
        if (comment !== undefined) {
            var user = $(this).find('a').attr('href').substr(1);
            for (var i = 0; i < APPROVALS.length; i++) {
                if (comment.indexOf(APPROVALS[i]) >= 0) {
                    for (var j = 0; j < reviewers.length; j++) {
                        if (reviewers[j].userId === user && reviewers[j].approved === false) {
                            //console.log("Approved: ", user);
                            reviewerChange = true;
                            reviewers[j].approved = true;
                        }
                    }
                }
            }
        }
    });
    return reviewerChange;
}

function updateReviewers() {
    var $comments = $(GH_COMMENT_CLASS);
    var numReviewers = reviewers.length;
    updateCommentReviewers($comments);
    var reviewerChange = updateApprovers($comments);

    return reviewers.length !== numReviewers || reviewerChange;
}

function isPRApproved() {
    var isApproved = true;
    for (var i = 0; i < reviewers.length; i++) {
        if (reviewers[i].approved === false) {
            isApproved = false;
        }
    }
    return isApproved;
}

function isCommentDiv(mutation) {
    var isDiscussion = mutation.target.className.indexOf('js-discussion') >= 0;
    var isComment = mutation.target.className.indexOf('timeline-comment-wrapper') >= 0;
    return isDiscussion || isComment;
}

function runRHforPR() {
    var change = updateReviewers();
    var $rhApprovalDiv;
    if (reviewers.length > 0) {
        $rhApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
    } else {
        $rhApprovalDiv = null;
    }

    if (change) {
        $rhApprovalDiv = createPRApprovalStatus();
        if (isPRApproved()) {
            enableMergeButton();
        } else {
            disableMergeButton();
        }
    }
    return $rhApprovalDiv;
}

function reviewHub(discussionDiv) {
    console.log("Starting up.");
    getFiles();
    var $rhApprovalDiv = runRHforPR();
    var $ghActionDiv = $(GH_BRANCH_ACTION_DIV);
    if ($rhApprovalDiv !== null) {
        $ghActionDiv.append($rhApprovalDiv);
    }

    // create an observer instance
    var discObserver = new MutationObserver(function(mutations) {
        console.log('Saw a mutation.', mutations);
        mutations.forEach(function(mutation) {
            if (isCommentDiv(mutation)) {
                $rhApprovalDiv = runRHforPR();
                console.log('Approval div', $rhApprovalDiv, reviewers.length);
            }
            var $oldRHApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
            //console.log($oldRHApprovalDiv);
            if (reviewers.length === 0) {
                console.log("Removing div");
                $oldRHApprovalDiv.remove();
            } else if (mutation.target.className.indexOf('discussion-timeline-actions') >= 0) {
                if ($oldRHApprovalDiv.length > 0) {
                    if ($rhApprovalDiv !== null) {
                        $oldRHApprovalDiv.replaceWith($rhApprovalDiv);
                    }
                } else {
                    if ($rhApprovalDiv !== null) {
                        $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
                    }
                }
            }
        });

    });

    // configuration of the observer:
    var config = {
        childList: true,
        subtree: true,
        characterData: true
    };

    // pass in the target node, as well as the observer options
    discObserver.observe(discussionDiv, config);

}

var reviewers = [];

if (document.querySelector(GH_DISCUSSION_DIV) === null) {
    var mainDiv = document.querySelector(GH_MAIN_DIV);
    // create an observer instance
    var running = false;
    var mainObserver = new MutationObserver(function(mutations) {
        var discussionDiv = document.querySelector(GH_DISCUSSION_DIV);
        console.log(discussionDiv);
        if (discussionDiv !== null) {
            if (running === false) {
                reviewHub(discussionDiv);
                running = true;
            }
        } else {
            running = false;
            reviewers = [];
        }

    });

    // configuration of the observer:
    var config = {
        childList: true,
        subtree: true
    };

    // pass in the target node, as well as the observer options
    mainObserver.observe(mainDiv, config);
} else {
    $(document).ready(function() {
        var discussionDiv = document.querySelector(GH_DISCUSSION_DIV);
        console.log(discussionDiv);
        reviewHub(discussionDiv);
    });
}
