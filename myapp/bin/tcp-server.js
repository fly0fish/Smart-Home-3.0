// 导入net模块:
const net = require('net')
const PORT = "9003"
const equipmentArray = []
const TIMEOUT = 30*1000; // 30秒没接收到数据就断开连接
const mysqlDb = require('./mysql.js')
const websocket = require('./websocket.js')
const tcpClient = require('./tcp-client.js');
const device = require('./device.js')
const { dhtData } = require('./device.js');


//创建服务器对象
const server = net.createServer((socket)=>{
  //connect
  let addr = socket.remoteAddress + ':' + socket.remotePort
  console.log(addr," connected.")

  // receive data
  socket.on("data",data=>{
	if(!socket.id){
		//接收的第一条数据作为其设备id
		socket.id = data.toString('ascii')
		console.log(socket.id)
		
		

		device.dhtUser(socket.id,function(err,result){
			if(err){
				console.log('查询用户失败')
			}else{
				if(!result){
					socket.end();
				}
			}
		});


		//设备地址
		socket.addr = addr

		//将设备socket存入列表
		addEquipment(socket)

		//存储连接到服务器的设备信息
		device.dhtConn(socket.id)
	}else{
		const json = JSON.parse(data)

		// 将接收到的数据作为最新的数据
		// let str = addr+" --> " + "tem:" + json.tem + "  " + "hum:" + json.hum
		socket.lastValue = json
		// console.log(str)

		//存储温湿度数据
		device.dhtData(socket.id,json.tem,json.hum)

		//发送websocket消息 
		websocket.sendData(socket.id,socket.lastValue)
	}
	

    // // 如果该socket没有id，就把当前数据赋值为id
	// // 等效于接收的第一条数据作为其设备id
    // if(!socket.id){
	// 		socket.id = data.toString('ascii')
	// 		socket.addr = addr
	// 		addEquipment(socket)
	// 	}
	// 	else{
	// 		//保存所接收到的数据
	// 		// date=new Date()

	// 		let dhtData = {
	// 			tem: null,
	// 			hum: null
	// 		}

	// 		mysqlDb.mysql.insert([socket.id,socket.lastValue],function (err) {
	// 			if(err){
	// 				// 保存数据失败只会影响历史数据的呈现。
	// 				console.log(socket.id,"保存数据失败：",err)
	// 			}
	// 		})
	// 		//发送websocket消息 
	// 		websocket.sendData(socket.id,socket.lastValue)
	// 	}
  })

  // close
  socket.on('close',()=>{
		console.log(addr,socket.id,"close")
		// console.log("equipmentArray.length:",equipmentArray.length)
		deleteEquipment(socket.id,socket.addr)
	})
	
	socket.on('error',()=>{
		console.log(addr,socket.id,"error")
		deleteEquipment(socket.id,socket.addr)
	})

	socket.setTimeout(TIMEOUT);
	// 超过一定时间 没接收到数据，就主动断开连接。
	socket.on('timeout', () => {
		console.log(socket.id,socket.addr,'socket timeout');
		deleteEquipment(socket.id,socket.addr)
		socket.end();
	});

})

server.on("error",(err)=>{
	console.log(err)
})

//开启监听
server.listen({port: PORT,host: '0.0.0.0'}, () => {
	console.log('TCP服务器 启动：', server.address())
	
	// 2秒后启动demo2 tcp client 以生成数据。
	setTimeout(() => {
		tcpClient.init()
	}, 2000);


})

// 给列表添加设备
function addEquipment(socket) {
	// 先从列表删除旧的同名连接
	deleteEquipment(socket.id,socket.addr)
	equipmentArray.push(socket)
	
}

// 从列表中删除设备
function deleteEquipment(id,addr){
	if(!id || !addr){
		return ;
	}

	let index = null
	let i
	// 从数组中找到它的位置
	for(i=0;i<equipmentArray.length;i++){
		if(equipmentArray[i].id === id && equipmentArray[i].addr === addr){
			index = i;
		}
	}
	// 从数组中删除该设备
	if(index != null){
		equipmentArray.splice(index,1)
	}
	
}

// 在列表中找到某个id、addr的设备，结果为数组，可能包含多个socket。
function findEquipment(id,addr) {
	let result = []
	let i

	for(i=0;i<equipmentArray.length;i++){
		if(equipmentArray[i].id === id && equipmentArray[i].addr === addr){
			result.push(equipmentArray[i])
		}
	}
	return result
}

// 在列表中找到某个id的设备，结果为数组
function findEquipmentById(id) {
	let result = []
	let i

	for(i=0;i<equipmentArray.length;i++){
		if(equipmentArray[i].id === id){
			result.push(equipmentArray[i])
		}
	}
	return result
}

// 给设备发送控制命令
function sentCommand(id,command,dhtData) {
	let equipments = findEquipmentById(id)
	if(equipments.length === 0){
		return;
	}
	if(command === 'set'){
		console.log('1111111111111111111111')
		equipments.forEach((socket)=>{
			data ={id:id,data:dhtData};
			const json = JSON.stringify(data);
			socket.write(json)
		})

	}else if(command === 'open'){
		equipments.forEach((socket)=>{
			socket.write("1", 'ascii')
		})
	}
	else if(command === 'close'){
		equipments.forEach((socket)=>{
			socket.write("0", 'ascii')
		})
	}

}

module.exports={
	equipmentArray:equipmentArray,
	addEquipment:addEquipment,
	deleteEquipment:deleteEquipment,
	findEquipment:findEquipment,
	sentCommand:sentCommand
}