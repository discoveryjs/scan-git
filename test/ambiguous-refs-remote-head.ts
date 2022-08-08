// https://git-scm.com/docs/git-rev-parse.html#Docuzmentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
export const shouldBeRemoteHead = [
    {
        ref: 'refs/remotes/origin/should-be-remote-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'remotes/origin/should-be-remote-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'origin/should-be-remote-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    }
];
