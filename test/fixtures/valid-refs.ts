export const validRefs = [
    {
        expandsTo: 'refs/heads/main',
        refs: ['refs/heads/main', 'heads/main', 'main'],
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        expandsTo: 'refs/heads/test',
        refs: ['refs/heads/test', 'heads/test', 'test'],
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        expandsTo: 'refs/remotes/origin/HEAD',
        refs: ['remotes/origin/HEAD', 'origin/HEAD', 'origin'],
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        expandsTo: 'refs/remotes/origin/main',
        refs: ['refs/remotes/origin/main', 'remotes/origin/main', 'origin/main'],
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        expandsTo: 'refs/tags/onmain-tag',
        refs: ['refs/tags/onmain-tag', 'tags/onmain-tag', 'onmain-tag'],
        oid: '7c2a62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        expandsTo: 'HEAD',
        refs: ['HEAD'],
        oid: '2dbee47a8d4f8d39e1168fad951b703ee05614d6'
    },
    {
        expandsTo: 'FETCH_HEAD',
        refs: ['FETCH_HEAD'],
        oid: '7b84f676f2fbea2a3c6d83924fa63059c7bdfbe2'
    },
    {
        expandsTo: 'ORIG_HEAD',
        refs: ['ORIG_HEAD'],
        oid: 'beda62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        expandsTo: 'MERGE_HEAD',
        refs: ['MERGE_HEAD'],
        oid: 'beda62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    },
    {
        expandsTo: 'CHERRY_PICK_HEAD',
        refs: ['CHERRY_PICK_HEAD'],
        oid: 'beda62cdbc2ef28afaaed3b6f3aef9b581e5aa8e'
    }
];
