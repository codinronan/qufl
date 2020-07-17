const storeFactory = require('./tokenstore');
const validatorFactory = require('./validation')
const helpers = require('./helpers')

class Qufl {
    constructor({JWT, secret, timeout = '15m'}) {
        this.jwt = JWT;
        this.secret = secret
        this.timeout = timeout
        this.store = storeFactory();
    }

    _verifyToken(token) {
        try {
            return this.jwt.verify(token, this.secret);
        } catch {
            return false;
        } 
    }

    signToken({agent, role, client='web', custom}) {
        const token = this.jwt.sign({ agent, role, client, type:"token", custom, }, this.secret, { expiresIn: this.timeout });
        const refresh = this.jwt.sign({ agent, role, client, type:"refresh", custom, }, this.secret);
        this.store.storeToken(agent, client);
        return { token, refresh }
    }

    refreshToken(refresh) {
        let { agent, role, client, custom } = refresh
        if (!this.store.checkToken(agent, client))
            throw Error("Refresh token removed");
        const token = this.jwt.sign({ agent, role, type:"token", custom, }, this.secret, { expiresIn: this.timeout });
        return { token };
    }

    removeToken(agent, client) {
        this.store.deleteToken(agent, client);    
    }

    getValidator({role, predicate = ()=>true}) {
        return (req, res, next) => {
            let tokenString = helpers.getToken(req);
            if (!tokenString) {
                res.status(401).send({
                    error: "No token provided"
                });
                return;
            }
            let token = this._verifyToken(tokenString);
            if (!token) {
                res.status(401).send({
                    error: "Token Invalid"
                })
                return;
            }
            if ((role && token.role != role ) || predicate(token)) {
                res.status(403, {
                    error: "Invalid permissions"
                })
            }
            req.qufl = token;
            next()
        }
    }
}