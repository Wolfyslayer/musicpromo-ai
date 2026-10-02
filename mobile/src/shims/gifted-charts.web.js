const Empty = () => null;
module.exports = new Proxy({}, { get: () => Empty });
