import React from "react"
import Barcode from "react-barcode"

function CodigoBarras({ codigo }) {
  if (!codigo) {
    return <span>Sem código</span>
  }

  return (
    <div style={{ marginTop: "6px" }}>
      <Barcode
        value={String(codigo)}
        format="CODE128"
        width={1.5}
        height={40}
        fontSize={12}
        displayValue={true}
      />
    </div>
  )
}

export default CodigoBarras