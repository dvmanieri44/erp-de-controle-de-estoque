import BarcodeScanner from "react-qr-barcode-scanner"

function ScannerCodigo({onDetect}){

return(

<div style={{width:"300px"}}>

<BarcodeScanner
width={300}
height={300}
onUpdate={(err,result)=>{
if(result){
onDetect(result.text)
}
}}
/>

</div>

)

}

export default ScannerCodigo