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

const GH_REPO_API_URL = 'https://api.github.com/repos/';
const GH_TITLE_DIV = '.entry-title strong';
const GH_MAIN_DIV = '.main-content';
const GH_PR_NUM = '.gh-header-number';
const GH_MERGE_BUTTON = '.btn.btn-primary.js-merge-branch-action';
const GH_PR_DIV = '.pull-request-tab-content';
const GH_DISCUSSION_DIV = '.discussion-timeline';
const GH_FILES_DIV = '.files-bucket';
const GH_BRANCH_ACTION_DIV = '.branch-action-item';
const GH_COMMENT_CLASS = '.timeline-comment-wrapper:not(.timeline-new-comment)';
const GH_LINE_COMMENT_DIV = '[id^=diff-for-comment]';
const GH_COMMENT_BODY = '.comment-body.js-comment-body';
const RH_REVIEWER_LIST_CLASS = 'reviewhub-reviewer-list';
const RH_APPROVAL_STATUS_CLASS = 'reviewhub-approval-status';
const RH_CLASS = 'reviewhub';
const APPROVALS = [
    ':+1:',
    ':shipit:',
    'approve'
];
var globalFiles = [];

var Reviewers = function() {
    this.fromComment = [];
    this.fromIssue = [];
    //this.fromFile = [];
};
var globalReviewers = new Reviewers();

var Reviewer = function(userId, kind) {
    this.userId = userId;
    this.kind = kind;
    this.approved = false;
    //console.log('Task instantiated with id: ' + id);
};

var PRFile = function(filename) {
    this.filename = filename;
    this.importance = 0;
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
        .addClass(RH_CLASS)
        .append($reviewerListJQuery);
    var $rhApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
    if ($rhApprovalDiv.length === 0) {
        $rhApprovalDiv = $('<div/>')
            .addClass(RH_APPROVAL_STATUS_CLASS)
            .addClass(RH_CLASS)
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
    console.log(globalReviewers.fromComment);
    globalReviewers.fromIssue.forEach(function(reviewer) {
        var checked = reviewer.approved ? "checked" : "unchecked";
        lis += "<li><input type='checkbox' disabled " + checked + "> " +
                reviewer.userId + "</li>";
    });
    globalReviewers.fromComment.forEach(function(reviewer) {
        var checked = reviewer.approved ? "checked" : "unchecked";
        lis += "<li><input type='checkbox' disabled " + checked + "> " +
                reviewer.userId + "</li>";
    });
    return lis;
}

function getFiles() {
    var commitText = $(GH_COMMENT_CLASS).first().find(GH_COMMENT_BODY).text();
    var repoName = $(GH_TITLE_DIV).find('a').attr('href').substr(1);
    var prNum = $(GH_PR_NUM).text().substr(1);
    var url = GH_REPO_API_URL + repoName + '/pulls/' + prNum + '/files';
    console.log('Calling GitHub files API.');
    $.ajax ( {
    type:       'GET',
    url:        url,
    dataType:   'JSON',
    success:    function (files) {
        files.forEach(function(file) {
            globalFiles.push(new PRFile(file.filename));
            //console.log(file);
            });
            getFileOrder(commitText);
        }
    });
}

function getFileOrder(commitText) {
    var plus = '';
    for (var i = 1; i <= 5; i++) {
        plus += '+';
        //console.log('Running update file:', plus);
        updateFileImportance(commitText, plus);
    }
}

function updateFileImportance(commitText, plus) {
    for (var i = 0, len = globalFiles.length; i < len; i++) {
        if (commitText.indexOf(plus + globalFiles[i].filename) >= 0) {
            globalFiles[i].importance = plus.length;
        }
    }
}

function compareFiles(a, b) {
    if (a.importance > b.importance) {
        return -1;
    }

    if (a.importance < b.importance) {
        return 1;
    }
    return 0;
}

function reorderFiles() {
    var $files = $('.file');
    console.log($files);
    globalFiles = globalFiles.sort(compareFiles);

    var $orderedFiles = [];
    for (var i = 0, len = globalFiles.length; i < len; i++) {
        $files.each(function(j) {
            //console.log($(this).find('div[data-path="' + globalFiles[i].filename + '"]'));
            if ($(this).find('div[data-path="' + globalFiles[i].filename + '"]').length != 0) {
                var $element = $(this).clone().addClass(RH_CLASS).attr('id','rh-' + 'i');
                $orderedFiles.push($element);
            }
        });
    }
    console.log($orderedFiles);
    for (var k = 0, olen = $orderedFiles.length; k < olen; k++) {
        $('#diff-' + k).replaceWith($orderedFiles[k][0]);
        //$('#diff-' + k).remove();
        console.log($orderedFiles[k][0]);
    }

}

function updateCommentReviewers($comments) {
    //console.log($comments);
    var commentReviewers = [];
    $comments.each(function() {
        var $comment = $(this).find('.comment-body.js-comment-body');
        var $reviewer = $comment.find('.user-mention');
        //console.log($reviewer);
        if ($reviewer.length > 0) {
            var userName = $reviewer.text().substr(1);
            if ($comment.text().indexOf(userName + '%') >= 0) {
                anyReviewers = true;
                var newReviewer = true;
                for (var i = 0; i < globalReviewers.length; i++) {
                    if (globalReviewers[i].userId == userName) {
                        newReviewer = false;
                    }
                }
                if (newReviewer) {
                    console.log("Adding new reviewer", userName);
                    commentReviewers.push(new Reviewer(userName, 'comment'));
                }
            }
        }
    });
    globalReviewers.fromComment = commentReviewers;
}

function checkApproved(user) {
    reviewerChange = false;
    globalReviewers.fromComment.forEach(function(reviewer) {
        if (reviewer.userId === user && reviewer.approved === false) {
            console.log("Approved: ", user);
            reviewerChange = true;
            reviewer.approved = true;
        }
    });
    globalReviewers.fromIssue.forEach(function(reviewer) {
        if (reviewer.userId === user && reviewer.approved === false) {
            console.log("Approved: ", user);
            reviewerChange = true;
            reviewer.approved = true;
        }
    });
    return reviewerChange;
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
                    checkApproved(user);
                }
            }
        }
    });
    return reviewerChange;
}

function updateReviewers() {
    var $comments = $(GH_COMMENT_CLASS);
    var numReviewers = globalReviewers.fromComment.length;
    updateCommentReviewers($comments);
    var reviewerChange = updateApprovers($comments);
    //console.log('Reviewers', globalReviewers.fromComment.length, numReviewers);
    return globalReviewers.fromComment.length !== numReviewers || reviewerChange;
}

function isPRApproved() {
    var isApproved = true;
    globalReviewers.fromComment.forEach(function(reviewer) {
        if (reviewer.approved === false) {
            isApproved = false;
        }
    });
    globalReviewers.fromIssue.forEach(function(reviewer) {
        if (reviewer.approved === false) {
            isApproved = false;
        }
    });
    return isApproved;
}

function isCommentDiv(mutation) {
    //var isDiscussion = mutation.target.className.indexOf('js-discussion') >= 0;
    //var isComment = mutation.target.className.indexOf('timeline-comment-wrapper') >= 0;
    var isDiscussion = mutation.target.className.indexOf('pull-request-tab-content') >= 0;
    var isComment = mutation.target.className.indexOf('js-discussion') >= 0;
    var isActionChange = mutation.target.className.indexOf('discussion-timeline-actions') >= 0;
    //console.log('PRTabC', isDiscussion, 'JS-disc', isComment, 'disc-tim-act', isActionChange);
    return isDiscussion || isComment || isActionChange;
}

function isFileDiv(mutation) {
    //console.log(mutation.target.className);
    var isDiscussion = mutation.target.className.indexOf('diff-view-commentable') >= 0;
    var isComment = mutation.target.className.indexOf('comment') >= 0;
    return isDiscussion || isComment;
}

function getNumReviewers() {
    return globalReviewers.fromComment.length + globalReviewers.fromIssue.length;
}

function preparePR() {
    updateReviewers();
    var $rhApprovalDiv = null;
    if (getNumReviewers() > 0) {
        $rhApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
    } else {
        $rhApprovalDiv = null;
    }

    $rhApprovalDiv = createPRApprovalStatus();
    if (isPRApproved()) {
        enableMergeButton();
    } else {
        disableMergeButton();
    }

    return $rhApprovalDiv;
}

function isReviewHubMutation(mutations) {
    var isRHMutation = false;
    var mutation = mutations[0];
    if (mutation.addedNodes.length > 0) {
        var node = mutation.addedNodes[0];
        if (node.className !== undefined && node.className.indexOf(RH_CLASS) >= 0) {
            isRHMutation = true;
        }
    }
    return isRHMutation;
}

function isRHMutation(mutations) {
    var isRHMutation = false;
    mutations.forEach(function(mutation) {
        //console.log(mutation.target.className, mutation.type);
        if (mutation.target.className !== null) {
            var className = mutation.target.className;
            if (className.indexOf('js-discussion') >= 0) {
                isRHMutation = true;
            } else if (className.indexOf('pull-merging') >= 0) {
                isRHMutation = true;

            } else if (className.indexOf('timeline-comment-wrapper') >= 0) {
                isRHMutation = true;

            } else if (className.indexOf('discussion-timeline-actions') >= 0) {
                isRHMutation = true;

            } else if (className.indexOf('context-loader-container') >= 0) {
                if (mutation.addedNodes.length > 0) {
                    isRHMutation = true;
                }
            }
        }
    });
    //console.log(isRHMutation);
    return isRHMutation;
}

//if (document.querySelector(GH_DISCUSSION_DIV) === null) {
function start() {
    console.log('Starting up');
    var mainDiv = document.querySelector(GH_MAIN_DIV);

    var mainObserver = new MutationObserver(function(mutations) {
        console.log('Main observer:', mutations);
        var discussionDiv = $(GH_DISCUSSION_DIV);
        var filesDiv =$(GH_FILES_DIV);
        //console.log('Discussion div', discussionDiv, 'Files div', filesDiv);
        if (isRHMutation(mutations)) {
            if (discussionDiv.length > 0) { //&& isReviewHubMutation(mutations))

                $rhApprovalDiv = preparePR();
                if (getNumReviewers() > 0) {
                    getFiles();
                }
                //console.log('Approval div', $rhApprovalDiv, getNumReviewers());

                mutations.forEach(function(mutation) {
                    var $oldRHApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
                    //var discussionChanged = false;
                    if (isCommentDiv(mutation)) {
                        if (getNumReviewers() === 0) {
                            console.log("Removing div");
                            $oldRHApprovalDiv.remove();
                        } else {
                            if ($oldRHApprovalDiv.length > 0 && $rhApprovalDiv !== null) {
                                //console.log('Replacing RH Action');
                                $oldRHApprovalDiv.replaceWith($rhApprovalDiv);
                            } else if ($rhApprovalDiv !== null) {
                                //console.log('Adding new RH Action');
                                $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
                            }
                        }
                    }
                });
            } else if (filesDiv.length > 0) {// && !isReviewHubMutation(mutations))
                console.log('File mutation.');
                reorderFiles();
                // mutations.forEach(function(mutation) {
                //     if (isFileDiv(mutation)) {
                //
                //     }
                // });
            }

        } else if ($(GH_PR_DIV).length == 0) {
            console.log('Clearing globals.', $(GH_PR_DIV));
            globalReviewers = null;
            globalFiles = {};
        }
    });



    // configuration of the observer:
    var config = {
        childList: true,
        //characterData: true,
        subtree: true
    };

    // pass in the target node, as well as the observer options
    mainObserver.observe(mainDiv, config);

    if (document.querySelector(GH_DISCUSSION_DIV) !== null) {
        getFiles();
        $rhApprovalDiv = preparePR();
        $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
    }
}
// } else {
//     $(document).ready(function() {
//         var discussionDiv = document.querySelector(GH_DISCUSSION_DIV);
//         //console.log(discussionDiv);
//         reviewHub(discussionDiv);
//     });
// }

$(document).ready(function() {
    start();
});

// function reviewHub(discussionDiv) {
//     console.log("Starting up.");
//
//     getFiles();
//     var $rhApprovalDiv = preparePR();
//     var $ghActionDiv = $(GH_BRANCH_ACTION_DIV);
//     if ($rhApprovalDiv !== null) {
//         $ghActionDiv.append($rhApprovalDiv);
//     }
//
//     // create an observer instance
//     var discObserver = new MutationObserver(function(mutations) {
//         console.log('Saw a disc mutation.', mutations);
//         mutations.forEach(function(mutation) {
//             if (isCommentDiv(mutation)) {
//                 getFiles();
//                 $rhApprovalDiv = preparePR();
//                 console.log('Approval div', $rhApprovalDiv, globalReviewers.length);
//             }
//
//             var $oldRHApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
//             if (globalReviewers.length === 0) {
//                 console.log("Removing div");
//                 $oldRHApprovalDiv.remove();
//             } else if (mutation.target.className.indexOf('discussion-timeline-actions') >= 0) {
//                 if ($oldRHApprovalDiv.length > 0) {
//                     if ($rhApprovalDiv !== null) {
//                         $oldRHApprovalDiv.replaceWith($rhApprovalDiv);
//                     }
//                 } else {
//                     if ($rhApprovalDiv !== null) {
//                         $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
//                     }
//                 }
//             }
//         });
//
//     });
//
//     // configuration of the observer:
//     var config = {
//         childList: true,
//         subtree: true,
//         characterData: true
//     };
//
//     // pass in the target node, as well as the observer options
//     discObserver.observe(discussionDiv, config);
//
//     // create an observer instance
//     var navObserver = new MutationObserver(function(mutations) {
//         console.log('Saw a files mutation.', mutations);
//         mutations.forEach(function(mutation) {
//             if ($(GH_DISCUSSION_DIV).length > 0) {
//                 getFiles();
//                 $rhApprovalDiv = preparePR();
//                 console.log('Approval div', $rhApprovalDiv, globalReviewers.length);
//                 var $oldRHApprovalDiv = $('.' + RH_APPROVAL_STATUS_CLASS);
//                 //console.log($oldRHApprovalDiv);
//                 if (globalReviewers.length === 0) {
//                     console.log("Removing div");
//                     $oldRHApprovalDiv.remove();
//                 } else if (mutation.target.className.indexOf('discussion-timeline-actions') >= 0) {
//                     if ($oldRHApprovalDiv.length > 0) {
//                         if ($rhApprovalDiv !== null) {
//                             $oldRHApprovalDiv.replaceWith($rhApprovalDiv);
//                         }
//                     } else {
//                         if ($rhApprovalDiv !== null) {
//                             $(GH_BRANCH_ACTION_DIV).append($rhApprovalDiv);
//                         }
//                     }
//                 }
//             } else if ($(GH_FILES_DIV).length > 0) {
//                 reorderFiles();
//             }
//
//         });
//
//     });
//     // pass in the target node, as well as the observer options
//     var navDiv = document.querySelector('.repository-content');
//     console.log(navDiv);
//     navObserver.observe(navDiv, config);
// }
