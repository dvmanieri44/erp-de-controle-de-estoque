import React from "react"

function CardInfo({ titulo, valor }) {
  return (
    <div className="card-info">
      <h3>{titulo}</h3>
      <p>{valor}</p>
    </div>
  )
}

export default CardInfo