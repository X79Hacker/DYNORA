// Shared by the apartment, canteen and browser regression fixture. Button
// handlers never depend on the nested icon/text that was actually clicked.
export function wireRecordingControls({record,exportButton,clear,isRecording,isBusy,setRecording,exportData,clearData,onNewRecording=()=>{},onError=console.error}){
 let acting=false;
 const action=async fn=>{if(acting||isBusy())return;acting=true;record.disabled=exportButton.disabled=clear.disabled=true;try{await fn()}catch(error){onError(error)}finally{acting=false;record.disabled=exportButton.disabled=clear.disabled=isBusy()}};
 record.onclick=()=>action(async()=>{if(isRecording()){setRecording(false);await exportData()}else{await clearData();onNewRecording();setRecording(true)}});
 exportButton.onclick=()=>action(async()=>{if(isRecording())setRecording(false);await exportData()});
 clear.onclick=()=>action(async()=>{if(isRecording()){setRecording(false);if(await exportData()!==true)return}await clearData()});
}
