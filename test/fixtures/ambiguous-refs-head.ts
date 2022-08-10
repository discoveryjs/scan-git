// https://git-scm.com/docs/git-rev-parse.html#Documentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
// References that are resolving into refs/heads/HEAD

export const shouldBeBranch = [
    // refs/heads/should-be-head
    {
        ref: 'refs/heads/should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'heads/should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },

    // refs/remotes/should-be-head
    {
        ref: 'refs/remotes/should-be-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'remotes/should-be-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },

    // inside the with-slash folder
    // refs/heads/with-slash/should-be-head
    {
        ref: 'refs/heads/with-slash/should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'heads/with-slash/should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'with-slash/should-be-head',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },

    // refs/remotes/with-slash/should-be-head
    {
        ref: 'refs/remotes/with-slash/should-be-head',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        ref: 'remotes/with-slash/should-be-head',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    }
];
