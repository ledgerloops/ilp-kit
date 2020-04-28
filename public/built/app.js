"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }
  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function() {
    var self = this,
      args = arguments;
    return new Promise(function(resolve, reject) {
      var gen = fn.apply(self, args);
      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }
      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }
      _next(undefined);
    });
  };
}

/* global Vue */
function get(resource, creds) {
  return fetch(resource, {
    method: "GET",
    headers: {
      Authorization: "Basic ".concat(btoa(creds))
    }
  }).then(response => response.json());
}

function put(resource, data, creds) {
  var method =
    arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "PUT";
  return fetch(resource, {
    method,
    headers: {
      Authorization: "Basic ".concat(btoa(creds))
    },
    body: JSON.stringify(data)
  }).then(response => response.json());
}

var app = new Vue({
  el: "#app",
  data: {
    session: null,
    loggingin: false,
    registering: false,
    ready: false,
    username: null,
    password: null,
    repeat: null,
    tab: "profile",
    edit: -1,
    expand: -1,
    pay: -1,
    payAmount: 0,
    contacts: [],
    transactions: []
  },
  computed: {
    editTrust: {
      get() {
        var min =
          this.contacts[this.edit].min === undefined
            ? 0
            : this.contacts[this.edit].min;
        return -min;
      },

      set(val) {
        var trust = Number.isNaN(val) ? 0 : val;
        this.contacts[this.edit].min = -trust;
      }
    }
  },
  methods: {
    register() {
      if (this.repeat === this.password) {
        this.checkSession();
      } else {
        window.alert("Passwords don't  match!"); // eslint-disable-line no-alert
      }
    },

    login() {
      this.checkSession();
    },

    logout() {
      this.session = null;
      this.username = null;
      this.password = null;
      this.repeat = null;
      setTimeout(() => {
        localStorage.removeItem("creds");
      }, 0);
    },

    checkSession() {
      var creds = "".concat(this.username, ":").concat(this.password); // make a copy of the model values to avoid race conditions

      get("/session", creds)
        .then(data => {
          if (data.ok) {
            this.loggingin = false;
            this.registering = false;
            this.session = true; // save the session in localStorage:

            setTimeout(() => {
              localStorage.setItem("creds", creds);
            }, 0);
            this.fetchData("contacts");
            this.fetchData("transactions");
          }

          this.ready = true;
        })
        .catch(() => {
          this.ready = true;
        });
    },

    fetchData(resource) {
      get(
        "/".concat(resource),
        "".concat(this.username, ":").concat(this.password)
      ).then(data => {
        if (data[resource]) {
          this[resource] = data[resource];
        }
      });
    },

    save(resource, index) {
      var { id } = this[resource][index];

      if (id === undefined) {
        id = "new";
      }

      put(
        "/".concat(resource, "/").concat(id),
        this[resource][index],
        "".concat(this.username, ":").concat(this.password)
      ).then(data => {
        if (data[resource]) {
          this[resource] = data[resource];
        }
      });
    },

    deleteContact(index) {
      put(
        "/contacts/".concat(this.contacts[index].id),
        {},
        "".concat(this.username, ":").concat(this.password),
        "DELETE"
      ).then(data => {
        if (data.contacts) {
          this.contacts = data.contacts;
        }
      });
    },

    doPay(index) {
      var _this = this;

      return _asyncToGenerator(function*() {
        // console.log('paying '+index+' '+this.payAmount);
        // console.log(' (balance '+ this.contacts[index].current+')');
        var amount = parseInt(_this.payAmount, 10);
        var topup =
          _this.contacts[index].current +
          _this.contacts[index].receivable +
          amount -
          _this.contacts[index].max; // FIXME: these PUTs should be POSTs
        // (blocked on https://github.com/ledgerloops/hubbie/issues/20)

        if (topup > 0) {
          // console.log('topup needed first!', { amount, topup });
          yield put(
            "/topup",
            {
              contactName: _this.contacts[index].name,
              amount: topup
            },
            "".concat(_this.username, ":").concat(_this.password)
          );
        } else {
          // console.log('no topup needed!', { amount, topup });
        }

        var data = yield put(
          "/pay",
          {
            contactName: _this.contacts[index].name,
            amount: parseInt(_this.payAmount, 10)
          },
          "".concat(_this.username, ":").concat(_this.password)
        );

        if (data.contacts) {
          _this.contacts = data.contacts;
        }

        if (data.transactions) {
          _this.transactions = data.transactions;
        }
      })();
    }
  }
});
setTimeout(() => {
  var creds = localStorage.getItem("creds");

  if (creds === null) {
    app.ready = true;
    return;
  }

  var parts = creds.split(":");
  [app.username, app.password] = parts;
  app.checkSession();
}, 0);
//# sourceMappingURL=app.js.map
