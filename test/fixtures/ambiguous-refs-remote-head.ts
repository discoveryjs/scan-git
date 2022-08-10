// https://git-scm.com/docs/git-rev-parse.html#Documentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
// References that are resolving into a remote HEAD

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
    },

    // refs/remotes/origin/with-slash/should-be-remote-head
    {
        ref: 'refs/remotes/origin/with-slash/should-be-remote-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'remotes/origin/with-slash/should-be-remote-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'origin/with-slash/should-be-remote-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    }
];
