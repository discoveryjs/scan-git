// https://git-scm.com/docs/git-rev-parse.html#Documentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
export const shouldBeTag = [
    // refs/tags/should-be-tag
    {
        ref: 'refs/tags/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'tags/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },

    // refs/heads/should-be-tag
    {
        ref: 'refs/heads/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'heads/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },

    // refs/remotes/should-be-tag
    {
        ref: 'refs/remotes/should-be-tag',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        ref: 'remotes/should-be-tag',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },

    // refs/remotes/origin/should-be-tag
    {
        ref: 'refs/remotes/origin/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'remotes/origin/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'origin/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },

    // inside the with-slash folder
    // refs/tags/with-slash/should-be-tag
    {
        ref: 'refs/tags/with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'tags/with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },

    // refs/heads/with-slash/should-be-tag
    {
        ref: 'refs/heads/with-slash/should-be-tag',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        ref: 'heads/with-slash/should-be-tag',
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },

    // refs/remotes/with-slash/should-be-tag
    {
        ref: 'refs/remotes/with-slash/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        ref: 'remotes/with-slash/should-be-tag',
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },

    // refs/remotes/origin/with-slash/should-be-tag
    {
        ref: 'refs/remotes/origin/with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'remotes/origin/with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        ref: 'origin/with-slash/should-be-tag',
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    }
];
