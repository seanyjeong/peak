function continueWithExpectedAcademy(req, res, next) {
    const expected = req.headers['x-academy-bridge-expected-academy'];
    if (expected === undefined) return next();
    if (typeof expected !== 'string' || !/^[1-9][0-9]*$/.test(expected)
        || !Number.isSafeInteger(Number(expected)) || Number(expected) !== Number(req.user.academyId ?? req.user.academy_id)) {
        return res.status(403).json({ error: 'provider_scope_mismatch' });
    }
    res.setHeader('x-academy-bridge-verified-academy', expected);
    return next();
}

module.exports = { continueWithExpectedAcademy };
