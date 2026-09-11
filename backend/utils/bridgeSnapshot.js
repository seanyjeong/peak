const crypto = require('node:crypto');

function snapshotHash(row) {
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(sorted(row))).digest('hex')}`;
}
function sorted(value) {
    if (Array.isArray(value)) return value.map(sorted);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}
function exerciseSnapshot(row) {
    return snapshotHash({ ...row, tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags });
}

module.exports = { snapshotHash, exerciseSnapshot };
