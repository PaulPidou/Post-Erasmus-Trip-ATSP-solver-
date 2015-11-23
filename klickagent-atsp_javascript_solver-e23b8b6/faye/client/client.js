//core functions:
 
//uuid
var s4 = function() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

var uuid = function() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
};


//settings:

var client_id = uuid();
var accepts_jobs = 1;

document.body.onload = function(event) {
	document.getElementById('client_id').innerHTML = client_id;
};


//faye client:
var client = new Faye.Client('http://yourserver.com:8888/');

client.subscribe('/acquireWorkers', function(message) {

	
	//ignore itself:
	if( message.sender_id === client_id ) return;
	
  	logToScreen( JSON.stringify( message ) );
  	
  	if( accepts_jobs > 0 ){
  		accepts_jobs--;
  		
  		client.subscribe( message.subscribeTo , function(message) { });
  		
  		
  		var jobchannel = '/'+uuid();
  		client.publish(message.subscribeTo, {
  			"sender_id": client_id,
  			"sender_id": client_id,
  			"client_id_parent": message.sender_id,
  			"acceptJobUnder": jobchannel
  		});
  		
  		client.subscribe( jobchannel , function( jobmessage ) {
  				
  				//ignore itself:
  				if( jobmessage.sender_id === client_id ) return;
  				console.log(jobmessage);
  				
  				
  				switch( jobmessage.action ) {
  					case 'startJob':
  						console.log('execute');
  						eval( 'var job = ' + jobmessage.job + ';');
  						job( jobmessage.job_params ).then(function( result ){
  							
  							client.publish(jobchannel, {
  									"sender_id": client_id,
  									"result" : 'finished'
  								});
  							client.publish(jobchannel, {
  								"sender_id": client_id,
  								"result" : JSON.stringify( result )
  							});
  							
  						});
  					break;
  					
  					case 'getResult':
  					
  					break;
  					
  					default:
  					
  					break;
  				
  				}
  		});
  		
  		
  	}
  	
  	
});



var acquireWorkers = function(){
	client.publish('/acquireWorkers', {
		"sender_id": client_id,
	  	"sender_id": client_id,
	  	"subscribeTo": '/workers_'+client_id
	});
	
	client.subscribe('/workers_'+client_id, function(message) {

		//ignore all except parent!
		if( client_id !== message.client_id_parent ){
			return;
		}
		
		logToScreen( 'worker ' + message.sender_id + ' acquired' );		
		
		
		client.subscribe(message.acceptJobUnder, function( jobresultmessage ) {
			if( client_id === jobresultmessage.sender_id ){
				return;
			}
			
			logToScreen(jobresultmessage.result);
		});
		
		
		client.publish(message.acceptJobUnder, {
			"sender_id": client_id,
			"action": 'startJob',
			"job" : 'permuteExample',
			"job_params" : ''
		});
		
		
		
		
		
		
		
	});
};


var logToScreen = function(txt){
	document.getElementById('log').innerHTML += '<br/>'+txt;
};













//algorithm
var permArr = [], usedChars = [];
var len;
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

function permuteExample(){
	var deferred = Q.defer();


	var arr = [];
	for(var i = 0 ; i < 10 ; i++ ){
		arr.push(i); //[i,i+1]
	};
	var permutations = permute(arr);
	
	deferred.resolve(permutations);
	
	return deferred.promise;
}; 