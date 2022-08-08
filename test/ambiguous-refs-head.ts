// https://git-scm.com/docs/git-rev-parse.html#Docuzmentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
export const shouldBeHead = [
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

    // refs/remotes/origin/should-be-head
    {
        ref: 'refs/remotes/origin/should-be-head',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        ref: 'remotes/origin/should-be-head',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        ref: 'origin/should-be-head',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },

    // with-slash
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
    },

    // refs/remotes/origin/with-slash/should-be-head
    {
        ref: 'refs/remotes/origin/with-slash/should-be-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'remotes/origin/with-slash/should-be-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'origin/with-slash/should-be-head',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    }
];
