/** The TSP_Solver Module module:TSP_Solver.
 * @module TSP_Solver
 */
(function(globals){
  "use strict";

	var clone = function( o ) {
		var i, myObj = (o instanceof Array) ? [] : {};
		for (i in o) {
			if (o[i] && typeof o[i] == "object") {
				myObj[i] = clone(o[i]);
			} else 
				myObj[i] = o[i];
			}
		return myObj;
	};


	if( typeof module !== 'undefined' ){
		var MODE = 'node';
		var TSP_Solver_Worker = null;
		//var TSP_Solver_Worker get defined by require the js file
	} else if(typeof window === 'undefined' ){ 
		var MODE = 'webworker';
		var TSP_ns = self;
		var TSP_Solver_Worker = globals;
		
		var x = (self.location.origin+self.location.pathname).split('/'); 
		x.splice(-1,1);
		var TSP_SOLVER_DOMAIN = x.join('/');
		//console.error(TSP_SOLVER_DOMAIN);
	} else {
		var MODE = 'normal';
		var TSP_ns = this;
		var TSP_Solver_Worker = globals;
		
		var scripts = document.getElementsByTagName("script"),
		    x = scripts[scripts.length-1].src.split('/'); 
		x.splice(-1,1);
		var TSP_SOLVER_DOMAIN = x.join('/');
		//console.error(TSP_SOLVER_DOMAIN);
	}
	
	if( MODE === 'webworker' ){
		
		/*console.log = function(){ 
			postMessage({cmd: 'console.log', content: Array.prototype.slice.call(arguments)}); 
		};
		*/
		
		//if only gui thread and 1 worker thread, import script here
		globals.insideWebworker = true;
		
		//ios bug: self.location.origin is undefined!
		//self.importScripts( TSP_SOLVER_DOMAIN + "/TSP_Solver_Worker.js");
		//app/javascript/
		self.importScripts( "TSP_Solver_Worker.js");
	}
	

	
	
	/** internal TSP Solver Class
		* @constructor
		* @protected
		* @class TSP_Solver
	*/
	globals.TSP_Solver = function() {
	
		/** to stop the solving process
			* @member {boolean}
			* @protected
		*/
		this.stopped = false;
		/** array of the best tour found
			* @member {array}
			* @protected
		*/
		this.bestTour = [];
		/** integer value for the best tour weight found
			* @member {integer}
			* @protected
		*/
		this.bestTourWeight = null;
		
		/** array of the start tour
			* @member {array}
			* @protected
		*/
		this.startTour = [];
		/** integer value for the start tour weight
			* @member {integer}
			* @protected
		*/
		this.startTourWeight = null;
		
		/** object for event storage ({@link TSP_Solver#registerEvent}) TSP solver
			* @member {object}
			* @protected
		*/
		this.hooks = {
			onSolutionFound: function(){},
			onSuccess: function(){},
			onError: function(){}
		};
		
		
		//holds the tsp
		this.tsp = new TSP_Solver_Worker.tsp();
		
		/** stop execution of TSP solver
			* @function
			* @protected
		*/
		this.stop = function(){
			this.stopped = true;
			this.nodeCalc.stop();
		};
		
		/** addCities to the TSP solver
			* @function
			* @protected
			* @param {array} distanceTable - Distance table
			* @param {array} waypoints - Waypoints array (currently not needed)
		*/
		this.addCities = function(distanceTable,cities){
			this.tsp.addDistances(distanceTable);
		};
		
		/** solve the given tsp in {@link TSP_Solver#addCities}
			* @function
			* @protected
			* @param {mixed} algo - true (boolean) to autodetect best fitting algorithm for the tsp.
			* BruteForce / BnB / Dynamic / Antcolonyk2_k3 / Nearestneighbour to solve with a specific algorithm.
			* @param {mixed} mode - true (boolean) to autodetect best fitting execution mode.
			* normal / singlethread / webworker / server / server_multithread / client_distributed
			* @param {mixed} threadCount - If multithread execution mode selected, specify maximum of threads to use
		*/
		this.solve = function(algo,mode,calculationModeThreadMax){
			this.stopped = false;
			
			//fill startRoute:
			this.startTourWeight = this.tsp.tourLength;
			this.startTour = this.tsp.path;
			
			if( algo.toLowerCase() === 'bnb' ){
				this.solveBnB(mode, calculationModeThreadMax);
			} else {
				var _algo = function(string){ return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase(); }(algo);
				
				if( typeof this['solve'+_algo] !== 'function'){
					
					console.error('algorithm not found:'+_algo);
				} else {
				
					//todo: factory-pattern implementation:
					this['solve'+_algo](mode, calculationModeThreadMax);
					
				}
			}
		};
		
		/** solve tsp using brute force algorithm
			* @function
			* @protected
		*/
		this.solveBruteforce = function(){
			//algorithm
			var permArr = [], usedChars = [], len;
			function permute(input,r) {
				if( typeof r === 'undefined' ){
					len = input.length;
					var i, ch;
				}
			    for (i = 0; i < input.length; i++) {
			        ch = input.splice(i, 1)[0];
			        len--;
			        usedChars.push(ch);
			        if (input.length == 0) {
			            permArr.push(usedChars.slice());
			        }
			        permute(input,true);
			        input.splice(i, 0, ch);
			        len++;
			        usedChars.pop();
			    }
			    return permArr;
			};
			
			//remove starting point => is always starting point!
			this.tsp.path.splice(0, 1);
			var permutations = permute(this.tsp.path);
			//console.log(permutations);
			
			var currentBest = null;
			var currentBestLength = Infinity;
			var current,
				currentLength,i,j;
			//console.log(permutations);
			for( i in permutations){
				var permutation = permutations[i];
				
				//add starting point back again
				permutation.splice(0, 0, 0);
				//add startpoint to complete roundtrip
				permutation.splice(permutation.length, 0, 0);
				
				//console.log(permutation);
				currentLength = 0;
				for( j = 0; j < this.tsp.distCount ; j++) {
					//currentLength += this.tsp.cities[ permutation[j] ].w[ permutation[j+1] ];
					currentLength += this.tsp.dist[ permutation[j] ][ permutation[j+1] ];
				}
				if( currentLength < currentBestLength ) {
					currentBest = permutation;
					currentBestLength = currentLength;
				}
			}
			//console.log(currentBest,currentBestLength);
			currentBest.splice(-1, 1);
			this.bestTourWeight = currentBestLength;
			this.bestTour = currentBest;
			
			this.hooks.onSuccess();
			
		};
		
		/*mode 1 = a-z, 0 = roundtrip */
		var mode = 0;
		
		/** visited array for the waypoints already visite
			* @function
			* @protected
		*/
		this.initVisitedArray = function(){
			var visited = [];
			for (var i = 0; i < this.tsp.distCount; ++i) {
				visited[i] = false;
			}
			return visited;
		};
		
		/** solve tsp using dynamic (held-karp) algorithm
			* @function
			* @protected
		*/
		/* algorithm from https://github.com/geirke/optimap */
		/* max 15 wp */
		this.solveDynamic = function () {
		/* Solves the TSP problem to optimality. Memory requirement is
		 * O(this.tsp.distCount * 2^this.tsp.distCount)
		 */
		 	var nextSet = new Array();
			var bestPath = new Array();
			var bestLength = Infinity;
			/* Finds the next integer that has num bits set to 1.
			 */
			var nextSetOf = function(num,nextSet,tspCount) {
				var count = 0;
				var ret = 0;
				for (var i = 0; i < tspCount; ++i) {
					count += nextSet[i];
				}
				if (count < num) {
					for (var i = 0; i < num; ++i) {
						nextSet[i] = 1;
					}
					for (var i = num; i < tspCount; ++i) {
						nextSet[i] = 0;
					}
				} else {
					// Find first 1
					var firstOne = -1;
					for (var i = 0; i < tspCount; ++i) {
						if (nextSet[i]) {
							firstOne = i;
							break;
						}
					}
					// Find first 0 greater than firstOne
					var firstZero = -1;
					for (var i = firstOne + 1; i < tspCount; ++i) {
						if (!nextSet[i]) {
							firstZero = i;
							break;
						}
					}
					if (firstZero < 0) {
						return -1;
					}
					// Increment the first zero with ones behind it
					nextSet[firstZero] = 1;
					// Set the part behind that one to its lowest possible value
					for (var i = 0; i < firstZero - firstOne - 1; ++i) {
						nextSet[i] = 1;
					}
					for (var i = firstZero - firstOne - 1; i < firstZero; ++i) {
						nextSet[i] = 0;
					}
				}
				// Return the index for this set
				for (var i = 0; i < tspCount; ++i) {
					ret += (nextSet[i]<<i);
				}
				return ret;
			};
			var numCombos = 1<<this.tsp.distCount;
			var C = new Array();
			var parent = new Array();
			for (var i = 0; i < numCombos; ++i) {
				C[i] = new Array();
				parent[i] = new Array();
				for (var j = 0; j < this.tsp.distCount; ++j) {
					C[i][j] = 0.0;
					parent[i][j] = 0;
				}
			}
			for (var k = 1; k < this.tsp.distCount; ++k) {
				var index = 1 + (1<<k);
				C[index][k] = this.tsp.dist[0][k];
			}
			for (var s = 3; s <= this.tsp.distCount; ++s) {
				for (var i = 0; i < this.tsp.distCount; ++i) {
					nextSet[i] = 0;
				}
				var index = nextSetOf(s,nextSet,this.tsp.distCount);
				while (index >= 0) {
					for (var k = 1; k < this.tsp.distCount; ++k) {
						if (nextSet[k]) {
							var prevIndex = index - (1<<k);
							C[index][k] = Infinity;
							for (var m = 1; m < this.tsp.distCount; ++m) {
								if (nextSet[m] && m != k) {
									if (C[prevIndex][m] + this.tsp.dist[m][k] < C[index][k]) {
										C[index][k] = C[prevIndex][m] + this.tsp.dist[m][k];
										parent[index][k] = m;
									}
								}
							}
						}
					}
					index = nextSetOf(s,nextSet,this.tsp.distCount);
				}
			}
			for (var i = 0; i < this.tsp.distCount; ++i) {
				bestPath[i] = 0;
			}
			var index = (1<<this.tsp.distCount)-1;
			
			//mode roundtrip:
			var currNode = -1;
			bestPath[this.tsp.distCount] = 0;
			for (var i = 1; i < this.tsp.distCount; ++i) {
				if (C[index][i] + this.tsp.dist[i][0] < bestLength) {
					bestLength = C[index][i] + this.tsp.dist[i][0];
					currNode = i;
				}
			}
			bestPath[this.tsp.distCount-1] = currNode;
			/*
			mode A-z:
			} else {
				var currNode = this.tsp.distCount - 1;
				bestPath[this.tsp.distCount-1] = this.tsp.distCount - 1;
				bestLength = C[index][this.tsp.distCount-1];
			//}*/
			
			for (var i = this.tsp.distCount - 1; i > 0; --i) {
				currNode = parent[index][currNode];
				index -= (1<<bestPath[i]);
				bestPath[i-1] = currNode;
			}
			
			
			this.bestTourWeight = bestLength;
			bestPath.splice(-1,1);
			this.bestTour = bestPath;
			
			this.hooks.onSuccess();
			
		};
		
		
		
		this.solveAntcolonyk2_k3 = function() {
			this.solveAntcolonyk2_sys(true);
			this.solveK3_sys(true,this.bestTour,this.bestTourWeight);
		};
		
		this.solveAntcolonyk2 = function(){
			this.solveAntcolonyk2_sys();
		};
		
		/** solve tsp using ant colony and k2 algorithm
			* @function
			* @protected
		*/
		/* algorithm from https://github.com/geirke/optimap */
		this.solveAntcolonyk2_sys = function( combinedRun ){
			
			/* Computes a near-optimal solution to the TSP problem, 
			 * using Ant Colony Optimization and local optimization
			 * in the form of k2-opting each candidate route.
			 * Run time is O(numWaves * numAnts * this.tsp.distCount ^ 2) for ACO
			 * and O(numWaves * numAnts * this.tsp.distCount ^ 3) for rewiring?
			 * 
			 * if mode is 1, we start at node 0 and end at node this.tsp.distCount-1.
			 */
			 	var visited = this.initVisitedArray(),
			 		currPath = new Array(),
			 		bestPath = new Array(),
			 		bestLength = Infinity;
				var alfa = 0.1; // The importance of the previous trails
				var beta = 2.0; // The importance of the this.tsp.distations
				var rho = 0.1;	// The decay rate of the pheromone trails
				var asymptoteFactor = 0.9; // The sharpness of the reward as the solutions approach the best solution
				var pher = new Array();
				var nextPher = new Array();
				var prob = new Array();
				var numAnts = 20;
				var numWaves = 20;
				for (var i = 0; i < this.tsp.distCount; ++i) {
					pher[i] = new Array();
					nextPher[i] = new Array();
				}
				for (var i = 0; i < this.tsp.distCount; ++i) {
					for (var j = 0; j < this.tsp.distCount; ++j) {
						pher[i][j] = 1;
						nextPher[i][j] = 0.0;
					}
				}
		
				var lastNode = 0;
				var startNode = 0;
				var numSteps = this.tsp.distCount - 1;
				var numValidDests = this.tsp.distCount;
				if (mode == 1) {
					lastNode = this.tsp.distCount - 1;
					numSteps = this.tsp.distCount - 2;
					numValidDests = this.tsp.distCount - 1;
				}
				for (var wave = 0; wave < numWaves; ++wave) {
					for (var ant = 0; ant < numAnts; ++ant) {
						var curr = startNode;
						var currDist = 0;
					for (var i = 0; i < this.tsp.distCount; ++i) {
						visited[i] = false;
					}
					currPath[0] = curr;
					for (var step = 0; step < numSteps; ++step) {
						visited[curr] = true;
						var cumProb = 0.0;
						for (var next = 1; next < numValidDests; ++next) {
							if (!visited[next]) {
								prob[next] = Math.pow(pher[curr][next], alfa) * 
						Math.pow(this.tsp.dist[curr][next], 0.0 - beta);
								cumProb += prob[next];
							}
						}
						var guess = Math.random() * cumProb;
						var nextI = -1;
						for (var next = 1; next < numValidDests; ++next) {
							if (!visited[next]) {
								nextI = next;
								guess -= prob[next];
								if (guess < 0) {
						nextI = next;
						break;
								}
							}
						}
						currDist += this.tsp.dist[curr][nextI];
						currPath[step+1] = nextI;
						curr = nextI;
					}
					currPath[numSteps+1] = lastNode;
					currDist += this.tsp.dist[curr][lastNode];
						
					// k2-rewire:
					var lastStep = this.tsp.distCount;
					if (mode == 1) {
						lastStep = this.tsp.distCount - 1;
					}
					var changed = true;
					var i = 0;
					while (changed) {
						changed = false;
						for (; i < lastStep - 2 && !changed; ++i) {
							var cost = this.tsp.dist[currPath[i+1]][currPath[i+2]];
							var revCost = this.tsp.dist[currPath[i+2]][currPath[i+1]];
							var iCost = this.tsp.dist[currPath[i]][currPath[i+1]];
							var tmp, nowCost, newCost;
							for (var j = i+2; j < lastStep && !changed; ++j) {
								nowCost = cost + iCost + this.tsp.dist[currPath[j]][currPath[j+1]];
								newCost = revCost + this.tsp.dist[currPath[i]][currPath[j]]
						+ this.tsp.dist[currPath[i+1]][currPath[j+1]];
								if (nowCost > newCost) {
						currDist += newCost - nowCost;
						// Reverse the detached road segment.
						for (var k = 0; k < Math.floor((j-i)/2); ++k) {
							tmp = currPath[i+1+k];
							currPath[i+1+k] = currPath[j-k];
							currPath[j-k] = tmp;
						}
						changed = true;
						--i;
								}
								cost += this.tsp.dist[currPath[j]][currPath[j+1]];
								revCost += this.tsp.dist[currPath[j+1]][currPath[j]];
							}
						}
					}
				
					if (currDist < bestLength) {
						bestPath = currPath;
						bestLength = currDist;
					}
					for (var i = 0; i <= numSteps; ++i) {
						nextPher[currPath[i]][currPath[i+1]] += (bestLength - asymptoteFactor * bestLength) / (numAnts * (currDist - asymptoteFactor * bestLength));
					}
				}
				for (var i = 0; i < this.tsp.distCount; ++i) {
					for (var j = 0; j < this.tsp.distCount; ++j) {
						pher[i][j] = pher[i][j] * (1.0 - rho) + rho * nextPher[i][j];
						nextPher[i][j] = 0.0;
					}
				}
			}
			
			
			this.bestTourWeight = bestLength;
			this.bestTour = bestPath;
			
			if( !combinedRun ){
				this.bestTour.splice(-1,1);
				this.hooks.onSuccess();
			}
		};
		
		
		
		this.solveK3 = function(){
			var bestPath = new Array(),
			bestLength = 0;
			
			//generate initial path:
			for (var j = 0; j < this.tsp.distCount; ++j) {
				bestPath.push(j);
				bestLength += this.tsp.dist[j][j+1];
			}
			bestPath.push(0);
			bestLength += this.tsp.dist[this.tsp.distCount-1][0];
			
			return this.solveK3_sys(false,bestPath,bestLength);
		};
		
		
		/** solve tsp using k3 (3-opt) algorithm
			* @function
			* @protected
		*/
		/* algorithm from https://github.com/geirke/optimap */
		this.solveK3_sys = function(combinedRun,bestPath,bestWeight) {
		
			
		
			var thisTSP = this;
		
			var costForward,costBackward,bestTrip,improved,currPath,currDist;
			
			
			
			
			// tspGreedy(mode);
			//currPath = new Array(bestPath.length);
			/*for (var i = 0; i < bestPath.length; ++i){
				currPath[i] = bestPath[i];
			}*/
			var currPath = clone(bestPath);
			
			var updateCosts = function(currPath) {
				costForward = new Array(currPath.length);
				costBackward = new Array(currPath.length);
		
				costForward[0] = 0.0;
				for (var i = 1; i < currPath.length; ++i) {
					costForward[i] = costForward[i-1] + thisTSP.tsp.dist[currPath[i-1]][currPath[i]];
				}
				bestTrip = costForward[currPath.length-1];
		
				costBackward[currPath.length-1] = 0.0;
				for (var i = currPath.length - 2; i >= 0; --i) {
					costBackward[i] = costBackward[i+1] + thisTSP.tsp.dist[currPath[i+1]][currPath[i]];
				}
			};
			
			var updatePerm = function(a, b, c, d, e, f) {
				/** 
					Update the current solution with the given 3-opt move.
				*/
				 
				improved = true;
				var nextPath = new Array(currPath.length);
				for (var i = 0; i < currPath.length; ++i) nextPath[i] = currPath[i];
				var offset = a + 1;
				nextPath[offset++] = currPath[b];
				if (b < c) {
					for (var i = b + 1; i <= c; ++i) {
						nextPath[offset++] = currPath[i];
					}
				} else {
					for (var i = b - 1; i >= c; --i) {
						nextPath[offset++] = currPath[i];
					}
				}
				nextPath[offset++] = currPath[d];
				if (d < e) {
					for (var i = d + 1; i <= e; ++i) {
						nextPath[offset++] = currPath[i];
					}
				} else {
					for (var i = d - 1; i >= e; --i) {
						nextPath[offset++] = currPath[i];
					}
				}
				nextPath[offset++] = currPath[f];
				currPath = nextPath;
		
				updateCosts(currPath);
			};
			
			var cost = function(a, b) {
				if (a <= b) {
					return costForward[b] - costForward[a];
				} else {
					return costBackward[b] - costBackward[a];
				}
			};
			
			var costPerm = function(a, b, c, d, e, f) {
					var A = currPath[a];
					var B = currPath[b];
					var C = currPath[c];
					var D = currPath[d];
					var E = currPath[e];
					var F = currPath[f];
					var g = currPath.length - 1;
			
					var ret = cost(0, a) + thisTSP.tsp.dist[A][B] + cost(b, c) + thisTSP.tsp.dist[C][D] + cost(d, e) + thisTSP.tsp.dist[E][F] + cost(f, g);
					return ret;
				};
			
			updateCosts(currPath);
			improved = true;
			while(improved) {
				improved = false;
				for (var i = 0; i < currPath.length - 3; ++i) {
					for (var j = i+1; j < currPath.length - 2; ++j) {
						for (var k = j+1; k < currPath.length - 1; ++k) {
							if (costPerm(i, i+1, j, k, j+1, k+1) < bestTrip)
								updatePerm(i, i+1, j, k, j+1, k+1);
							if (costPerm(i, j, i+1, j+1, k, k+1) < bestTrip)
								updatePerm(i, j, i+1, j+1, k, k+1);
							if (costPerm(i, j, i+1, k, j+1, k+1) < bestTrip)
								updatePerm(i, j, i+1, k, j+1, k+1);
							if (costPerm(i, j+1, k, i+1, j, k+1) < bestTrip)
								updatePerm(i, j+1, k, i+1, j, k+1);
							if (costPerm(i, j+1, k, j, i+1, k+1) < bestTrip)
								updatePerm(i, j+1, k, j, i+1, k+1);
							if (costPerm(i, k, j+1, i+1, j, k+1) < bestTrip)
								updatePerm(i, k, j+1, i+1, j, k+1);
							if (costPerm(i, k, j+1, j, i+1, k+1) < bestTrip)
								updatePerm(i, k, j+1, j, i+1, k+1);
						}
					}
				}
			}
			currDist = 0;
			for (var i = 0; i < bestPath.length-1; ++i){
				bestPath[i] = currPath[i];
				currDist+=thisTSP.tsp.dist[currPath[i]][currPath[i+1]];
			}
			this.bestTourWeight = currDist;
			bestPath.splice(-1,1);
			this.bestTour = bestPath;
	
			this.hooks.onSuccess();
		};
		
		
		
		
		/** solve tsp using nearest neighbour algorithm
			* @function
			* @protected
		*/
		/* algorithm from https://github.com/geirke/optimap */
		this.solveNearestneighbour = function(){
			var visited = this.initVisitedArray();
			var bestPath = new Array();
			
			var curr = 0,
				currDist = 0,
				numSteps = this.tsp.distCount - 1,
				lastNode = 0,
				numToVisit = this.tsp.distCount;
			if (mode == 1) {
				numSteps = this.tsp.distCount - 2;
				lastNode = this.tsp.distCount - 1;
				numToVisit = this.tsp.distCount - 1;
			}
			
			visited[0] = true;
			for (var step = 0; step < numSteps; ++step) {
				visited[curr] = true;
				bestPath[step] = curr;
				var nearest = Infinity;
				var nearI = -1;
				for (var next = 1; next < numToVisit; ++next) {
					if (!visited[next] && this.tsp.dist[curr][next] < nearest) {
						nearest = this.tsp.dist[curr][next];
						nearI = next;
					}
				}
				currDist += this.tsp.dist[curr][nearI];
				curr = nearI;
			}
			if (mode == 1){
				bestPath[numSteps] = lastNode;
			} else {
				bestPath[numSteps] = curr;
			}
			currDist += this.tsp.dist[curr][lastNode];
			
			
			this.bestTourWeight = currDist;
			this.bestTour = bestPath;
	
			this.hooks.onSuccess();
		};
		
		
		
		/** solve tsp using branch and bound algorithm
			* @function
			* @protected
		*/
		this.solveBnB = function( calculationMode, calculationModeThreadMax ){
			
			this.rootNode = new TSP_Solver_Worker.node(this.tsp,false, [0], 1);
			// 1. Set an initial value for the best tour cost 
			this.rootNode.lowerBound();
			
			//console.error('lower bound of node ' + this.rootNode.l + ' is ' + this.rootNode.lowerBound());
			
			/*this.test = new node(this,false, [0,1,2], 2);
			this.test = new node(this,false, [0,2,1], 2);
			console.log('lower bound of node ' + this.test.level + ' is ' + this.test.lowerBound());
			return;
			*/
			this.bestTour = this.rootNode.nodePath();
			this.bestTourWeight = this.rootNode.nodeWeight();
			
			//console.log('root path', this.bestTour );
			//console.log( 'root node weight', this.bestTourWeight );
			
			//init node calculator
			this.nodeCalc = new TSP_Solver_Worker.TSP_Node_Calc();
		
			//process node
			this.nodeCalc.processNode(this.tsp.save(),this.rootNode.save(),this.bestTourWeight,calculationMode,calculationModeThreadMax,this);	
		};
		
		/**
		 * Register an Event to the TSP Solver
		 * @method
		 * @param {string} eventName - name of event: allowed onSolutionFound, onSuccess, onError		 
		 * @param {function} fnct - function to be exececuted when event occurs
		 */
		
		this.registerEvent = function(eventName,fnct){
			this.hooks[eventName] = fnct;
		};
		
	};
	//208078
	
	
	
	
	
	
	globals.solve_tsp_helper_function = function(ns,waypoints,distanceTable,algo,mode,calculationModeThreadMax,params){
		var tsp_solver = new globals.TSP_Solver();
		
		tsp_solver.addCities(distanceTable,waypoints);
	
		
		/*tsp_solver.registerEvent('onSolutionFound',function(){
			ns.postMessage({type: 'status', bestTourWeight: tsp_solver.bestTourWeight, cities: tsp_solver.cities, bestTour: tsp_solver.bestTour, params: params});
		});*/
		
		tsp_solver.registerEvent('onSuccess',function(){
			ns.postMessage({
				type: 'result',
				cities: tsp_solver.cities, 
			
				bestTour: tsp_solver.bestTour,
				bestTourWeight: tsp_solver.bestTourWeight, 
				
				startTour: tsp_solver.startTour, 
				startTourWeight: tsp_solver.startTourWeight,
				
				params: params
			});
		
		});
		tsp_solver.solve(algo,mode,calculationModeThreadMax);
		return tsp_solver;
	};
	
	
	
	
	if( MODE === 'node' ){
		// 
		// ========
		module.exports = function( _TSP_Solver_Worker ) { 
		   TSP_Solver_Worker = _TSP_Solver_Worker;
		   return {
		      TSP_Solver: globals.TSP_Solver
		   }
		};
		/*module.exports = {
		  TSP_Solver: TSP_Solver
		};*/
		
		
	} else {
	
	
		
		/* event listener for messaging: */
		self.addEventListener('message', function(e) {
			
			var data = e.data;
			switch (data.cmd) {
			
				case 'tsp':
					globals.solve_tsp_helper_function(self,data.waypoints,data.distanceTable,data.algo,data.mode,data.modeThreadC);
					
				break;
				
				default:
					console.error('Unknown command (in '+TSP_SOLVER_DOMAIN+'/TSP_Solver.js): ' + data.msg);
			};
		}, false);
	}
}(this));