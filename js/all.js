/*================================================================
=>                  App = crm
==================================================================*/
/*global angular*/

var app = angular.module('crm', ['ngRoute']);


app.config(['$httpProvider', '$routeProvider', '$locationProvider',
    function($httpProvider, $routeProvider, $locationProvider) {
        'use strict';

        // This is required for Browser Sync to work poperly
        $httpProvider.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

        $routeProvider.when('/client/:clientId', {
            templateUrl: '/templates/client.html',
            controller: 'ClientCtrl'
        }).when('/client', {
            templateUrl: '/templates/client.html',
            controller: 'ClientCtrl'
        }).when('/self', {
            templateUrl: '/templates/client.html',
            controller: 'ClientCtrl'
        }).otherwise({
            templateUrl: 'templates/main.html',
            controller: 'MainCtrl'
        });

        //$locationProvider.html5Mode(true);
    }
]);


/*================================================================
=>                  crm App Run()  
==================================================================*/

app.run(['$rootScope',
    function($rootScope) {

        'use strict';

        console.log('Angular.js run() function...');
    }
]);




/* ---> Do not delete this comment (Values) <--- */

/* ---> Do not delete this comment (Constants) <--- */

/*================================================================
=>                  Controller = Client
==================================================================*/
/*global app*/

app.controller('ClientCtrl', ['$scope', '$routeParams', 'clientService', 'skuService', '$location',
    function($scope, $routeParams, clientService, skuService, $location) {

        'use strict';

        if ($location.path().indexOf('self') == -1) {
            $scope.client = clientService.getClient($routeParams.clientId);
        } else {
            $scope.client = clientService.getSelf();
            $scope.self = true;
        }
        $scope.skuOptions = _.pluck(skuService.getSkus(), 'name');
        $scope.shouldDisable = function(order) {
            return moment(order.date).startOf('day') < moment().startOf('day');
        };
        $scope.shouldShowButtons = function(order) {
            return !($scope.shouldDisable(order));
        };
        $scope.shouldShowButton = function(order) {
            return $scope.shouldShowButtons(order) && order.items.length >= 1 && order.items[order.items.length - 1].sku.name != '';
        };
        $scope.addOrderItem = function(order) {
            order.items.push(new OrderItem());
        };
        $scope.deleteOrderItem = function(order, item) {
            order.items = _.without(order.items, item);
            if (order.items.length == 0) {
                $scope.client.orders = _.without($scope.client.orders, order);
            }
        };
        $scope.addOrder = function() {
            $scope.client.orders.push(new Order([new OrderItem()]));
        };
        $scope.findSku = function(item) {
            var name = item.sku.name;
            item.sku = skuService.getSkuByName(name) || {
                name: name
            };
        };
        $scope.findSkuCategoryClass = function(skuCategory) {
            return skuService.getSkuCategoryIconClass(skuCategory);
        };
        $scope.getDuration = function(order, item) {
            return moment(order.date).add(item.sku.durationMonths, 'M').toDate();
        };

        $scope.chart = {
            chartData: []
        };

        var generateChartData = function(orders) {
            var items = _(orders).flatten('items');
            var filtered = items.filter(function(el) {
                return el.sku.category;
            });
            var mapWithAmounts = filtered.map(function(el) {
                return {
                    category: el.sku.category,
                    count: el.amount
                }
            });
            var groupedByCategory = mapWithAmounts.groupBy('category');
            var countedByCategory = groupedByCategory.map(function(el, num, key) {
                return {
                    category: num,
                    count: _.reduce(el, function(res, current) {
                        return +current.count + res;
                    }, 0)
                };
            });

            var data = countedByCategory.map(function(el) {
                return {
                    label: el.category,
                    value: el.count
                }
            }).value();

            return data;
        }

        var initilazed = false;

        $scope.$watch('client.orders', function(newValue, oldValue) {
            if (newValue) {
                var newData = generateChartData(newValue);
                var oldData = generateChartData(oldValue);
                var transform = function(el){return el.label +' '+el.value};
                var newLabels = _.map(newData, transform);
                var oldLabels = _.map(oldData, transform);
                var x = _.xor(newLabels, oldLabels);
                if (x.length != 0 || !initilazed) {
                    initilazed = true;
                    $scope.chart.chartData = newData;
                }
            }
        }, true);
    }
]);


/*-----  End of Controller = Client  ------*/

/*================================================================
=>                  Controller = Main
==================================================================*/
/*global app*/

app.controller('MainCtrl', ['$scope', '$location', 'clientService',
    function($scope, $location, clientService) {
        $scope.clients = clientService.getClients();
        $scope.addClient = function() {
            $location.path('/client');
        };
        $scope.showClient = function(clientId) {
            $location.path('/client/' + clientId);
        };
        $scope.showSelf = function() {
            $location.path('/self');
        };
        $scope.getMonthOrdersCount = function(monthShift) {
            var from = moment().subtract(monthShift || 0, 'M').startOf('month');
            var to = moment().subtract(monthShift || 0, 'M').endOf('month');
            var orders = _($scope.clients).pluck('orders').flatten();
            var ordersInDateRange = orders.filter(function(order){
            	return from.isBefore(order.date) && to.isAfter(order.date);
            });
            var ordersInRangeCount = ordersInDateRange.size();

            return ordersInRangeCount;
        };
    }
]);


/*-----  End of Controller = Main  ------*/

/*================================================================
=>                  Directive = DougnutChart
==================================================================*/
/*global app*/

app.directive('dougnutChart', [function() {

    'use strict';

    return {
        scope: {
            chartData: '='
        },
        restrict: 'E',
        template: '<canvas id="myChart" height="400" width="400"></canvas>',
        replace: true,
        link: function(scope, element, attrs) {
            var categoryColors = {
                'home': '#F7464A',
                'body': '#46BFBD',
                'dishware': '#FDB45C',
                'vitamins': '#5FE5FA'
            };
            var ctx = element[0].getContext("2d");
            var prepareColorsForData = function(valuesArray) {
                var result = _.map(valuesArray, function(el) {
                    el.color = categoryColors[el.label];
                    return el;
                });
                return result;
            }
            scope.chart = new Chart(ctx).Doughnut([], {
                responsive: true,
                animationSteps: 1,
            });

            scope.$watch('chartData', function(newValue) {
                if (newValue) {
                    scope.chart.initialize(prepareColorsForData(newValue));
                }
            });
        }
    };
}]);


/*-----  End of Directive = DougnutChart  ------*/

function Client(id, fullName, phone, orders,note) {
    this.id = id;
    this.fullName = fullName || '';
    this.phone = phone || '';
    this.orders = orders || [];
    this.note = note;
    this.getLastOrderDate = function() {
        var res = _.max(this.orders, 'date').date;
        return res;
    };
    this.whenToPhone = function() {
        var res = _(this.orders).map(function(order) {
            return order.getExpirationDate();
        }).min().valueOf();
        return isFinite(res) ? res : moment().toDate();
    };
};

function Order(items, date) {
    this.items = items || [];
    this.date = date || moment().toDate();
    this.getOrderPv = function() {
        var res = _(this.items).reduce(function(sum, item) {
            return sum + item.sku.pv * item.amount;
        }, 0);
        return res;
    };
    this.getExpirationDate = function() {
        var minDurationMonth = _(this.items).pluck('sku').min('durationMonths').valueOf().durationMonths;
        if (!isFinite(minDurationMonth)) {
            return this.date;
        }
        return moment(this.date).add(minDurationMonth, 'M').toDate();
    };
};

function OrderItem(sku, amount) {
	this.sku = sku || new Sku();    
    this.amount = amount || 1;
};

function Sku(name, pv, category, durationMonths) {
    this.name = name || '';
    this.pv = pv || 0;
    this.category = category;
    this.durationMonths = durationMonths;
};

/*================================================================
=>                   Factory = clientService
==================================================================*/
/*global app*/

app.factory('clientService', ['$rootScope', 'skuService',

    function($rootScope, skuService) {

        'use strict';

        var _clientList = [
            new Client(1, 'John Malkovich', '89568839923', [new Order([new OrderItem(skuService.getSkuByName('112342 Shampoo'), 1)], moment().subtract('days', 7).toDate()),
                new Order([new OrderItem(skuService.getSkuByName('432243 Toothpaste'), 1)], moment().subtract('days', 14).toDate())
            ], 'Family of three'),
            new Client(2, 'Pavel Durov', '89568839924', [new Order([new OrderItem(skuService.getSkuByName('654354 Stew-pan'), 1)], moment().subtract('days', 42).toDate())], 'Has a beard'),
            new Client(3, 'Andre Agassi', '89568839922', [new Order([new OrderItem(skuService.getSkuByName('223433 Vitamins'), 1)], moment().subtract('days', 3).toDate())], 'Birthday - 8 april')
        ];
        var _self = new Client(0, 'Myself', '89885889013', [new Order([new OrderItem(skuService.getSkuByName('984354 Bleach'), 1)], moment().subtract('days', 3).toDate())]);

        var _generateNewClientId = function() {
            return _.max(_clientList, 'id') + 1;
        };


        return {
            getClients: function() {
                return _clientList;
            },
            getClient: function(clientId) {
                var res = _(_clientList).find(function(client) {
                    return client.id == clientId
                });
                if (!res) {
                    res = new Client(_generateNewClientId());
                    _clientList.push(res);
                }
                return res;
            },
            getSelf: function() {
                return _self;
            }
        };

    }
]);


/*-----  End of Factory = clientService  ------*/

/*================================================================
=>                   Factory = skuService
==================================================================*/
/*global app*/

app.factory('skuService', ['$rootScope',
    function($rootScope) {

        'use strict';

        var _categoryIcons = {
            'body': 'fa-female',
            'vitamins': 'fa-heart',
            'home': 'fa-home',
            'dishware': 'fa-cutlery'
        };

        var _skus = [new Sku('112342 Shampoo', 2, 'body', 2),
            new Sku('223433 Vitamins', 7, 'vitamins', 1),
            new Sku('343425 Surface cleaner', 4, 'home', 2),
            new Sku('432243 Toothpaste', 1, 'body', 2),
            new Sku('556534 iCook pan', 65, 'dishware'),
            new Sku('654354 Stew-pan', 12, 'dishware'),
            new Sku('734856 Soap', 9, 'body', 1),
            new Sku('898343 Deospray', 14, 'body', 2),
            new Sku('984354 Bleach', 22, 'home', 3)
        ];

        return {
            getSkus: function() {
                return _skus;
            },
            getSkuByName: function(skuName) {
                return _.find(_skus, {
                    'name': skuName
                });
            },
            getSkuCategoryIconClass: function(skuCategory) {
                return _categoryIcons[skuCategory] || 'fa-asterisk';
            }
        };

    }
]);


/*-----  End of Factory = skuService  ------*/
