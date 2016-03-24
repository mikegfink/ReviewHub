# ReviewHub
GitHub Pull Request Review Modification

## Setup
### On Chrome:
  Download TamperMonkey
  Add ReviewHub.js as a new script.

## Usage
### Add Reviewers for a Repository:
  Create an issue called: ReviewHub Reviewers
  For each reviewer you'd like to have to review all merges for the repository, add a user mention (@username) followed by the '%' character to the issue text.
  e.g. To add two reviewers, type:
    @mikegfink%, @nicviclee%
    
### Add Reviewers to a Pull Request:
  To add a required reviewer for a particular Pull Request, add a comment with a user mention (@username) followed by the '%' character.
  e.g. To add a reviewer, comment:
    @mikegfink%
    
### Approve a Pull Request:
  To approve a Pull Request you are a reviewer for, add a comment with one of the following phrases:
    + ':+1:',
    + ':shipit:',
    + 'approve',
    + 'LGTM'
    
### Reorder files in a Pull Request
  To reorder files in a Pull Request you must be able to edit the Pull Request commit message.
  Files are reordered by typing the full file name prefixed with a '+' to indicate the level of importance. Files can be prefixed with up to 5 '+'s. Files prefixed with more '+'s are ordered before files with less '+'s in the Pull Request Diff view. Unmentioned files are treated as having 0 '+'s.
  e.g. 
  ++README.md
  +MyFile.java
  +++++YourFile.go
