// https://git-scm.com/docs/git-rev-parse.html#Documentation/git-rev-parse.txt-emltrefnamegtemegemmasterememheadsmasterememrefsheadsmasterem
// References that are resolving into refs/heads/HEAD

export const ambiguousRefsBranch = [
    {
        expandsTo: 'refs/heads/should-be-head',
        refs: ['refs/heads/should-be-head', 'heads/should-be-head', 'should-be-head']
    },
    {
        expandsTo: 'refs/remotes/should-be-head',
        refs: ['refs/remotes/should-be-head', 'remotes/should-be-head']
    },
    {
        expandsTo: 'refs/heads/with-slash/should-be-head',
        refs: [
            'refs/heads/with-slash/should-be-head',
            'heads/with-slash/should-be-head',
            'with-slash/should-be-head'
        ]
    },
    {
        expandsTo: 'refs/remotes/with-slash/should-be-head',
        refs: ['refs/remotes/with-slash/should-be-head', 'remotes/with-slash/should-be-head']
    }
];

export const ambiguousRefsRemoteBranch = [
    {
        expandsTo: 'refs/remotes/origin/should-be-remote-head',
        refs: [
            'refs/remotes/origin/should-be-remote-head',
            'remotes/origin/should-be-remote-head',
            'origin/should-be-remote-head'
        ]
    },
    {
        expandsTo: 'refs/remotes/origin/with-slash/should-be-remote-head',
        refs: [
            'refs/remotes/origin/with-slash/should-be-remote-head',
            'remotes/origin/with-slash/should-be-remote-head',
            'origin/with-slash/should-be-remote-head'
        ]
    }
];

export const ambiguousRefsTag = [
    {
        expandsTo: 'refs/tags/should-be-tag',
        refs: ['refs/tags/should-be-tag', 'tags/should-be-tag', 'should-be-tag']
    },
    {
        expandsTo: 'refs/heads/should-be-tag',
        refs: ['refs/heads/should-be-tag', 'heads/should-be-tag']
    },
    {
        expandsTo: 'refs/remotes/should-be-tag',
        refs: ['refs/remotes/should-be-tag', 'remotes/should-be-tag']
    },
    {
        expandsTo: 'refs/remotes/origin/should-be-tag',
        refs: [
            'refs/remotes/origin/should-be-tag',
            'remotes/origin/should-be-tag',
            'origin/should-be-tag'
        ]
    },
    {
        expandsTo: 'refs/tags/with-slash/should-be-tag',
        refs: [
            'refs/tags/with-slash/should-be-tag',
            'tags/with-slash/should-be-tag',
            'with-slash/should-be-tag'
        ]
    },
    {
        expandsTo: 'refs/heads/with-slash/should-be-tag',
        refs: ['refs/heads/with-slash/should-be-tag', 'heads/with-slash/should-be-tag']
    },
    {
        expandsTo: 'refs/remotes/with-slash/should-be-tag',
        refs: ['refs/remotes/with-slash/should-be-tag', 'remotes/with-slash/should-be-tag']
    },
    {
        expandsTo: 'refs/remotes/origin/with-slash/should-be-tag',
        refs: [
            'refs/remotes/origin/with-slash/should-be-tag',
            'remotes/origin/with-slash/should-be-tag',
            'origin/with-slash/should-be-tag'
        ]
    }
];
