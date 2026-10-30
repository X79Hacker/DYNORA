export function closestRouteProgress(curve,position,steps=256){let best=0,distance=Infinity;for(let i=0;i<=steps;i++){const p=curve.getPointAt(i/steps),d=(p.x-position.x)**2+(p.z-position.z)**2;if(d<distance){best=i/steps;distance=d;}}return best;}
export function spawnRover({rover,PX,physics,LAB,x,z,yaw=0,bounds=[-5,5,-4,4],settle=()=>{rover.robot.position.y=0;rover.robot.rotation.x=rover.robot.rotation.z=0;}}){
 if(![x,z,yaw].every(Number.isFinite))throw Error('Enter finite spawn X, Z and yaw');if(x<bounds[0]||x>bounds[1]||z<bounds[2]||z>bounds[3])throw Error('Spawn point is outside the map');
 const robot=rover.robot,position=robot.position.clone(),rotation=robot.rotation.clone();
 try{robot.position.set(x,0,z);robot.rotation.set(0,yaw,0,'YXZ');settle();robot.updateWorldMatrix(true,true);if(physics.robotBlocker(PX.drive,robot))throw Error('Spawn overlaps an obstacle. Choose a clear position.');}
 catch(error){robot.position.copy(position);robot.rotation.copy(rotation);settle();robot.updateWorldMatrix(true,true);physics.syncRobot(PX.drive,robot);throw error;}
 PX.reset();LAB.resetMeasurementPose?.();physics.syncRobot(PX.drive,robot);return{x:robot.position.x,y:robot.position.y,z:robot.position.z,yaw:robot.rotation.y,sim_time_s:PX.drive.time};
}
