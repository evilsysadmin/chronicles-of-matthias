// Plain-language field guide. Keep mechanics described here aligned with
// AGENTS.md, the active MM3 combat rules and the shop's real comparison data.
export default function ChroniclesGameHelp({ onBack }) {
  return (
    <div className="chronicles-game-help" data-chronicles-game-help>
      <div className="chronicles-game-help__head">
        <strong>Guía del aventurero</strong>
        <button type="button" onClick={onBack}>← Volver al menú</button>
      </div>
      <p>Consulta las reglas cuando las necesites, sin tapar la aventura con explicaciones.</p>
      <details open>
        <summary>Personajes y estadísticas</summary>
        <dl>
          <dt>PV · Vida</dt><dd>La salud del héroe. Con 0 PV queda fuera de combate.</dd>
          <dt>PH · Magia</dt><dd>Puntos utilizados para lanzar hechizos.</dd>
          <dt>CA · Armadura</dt><dd>Cuanto mayor es, más difícil resulta que te alcancen. No resta daño a los golpes acertados.</dd>
          <dt>Acierto</dt><dd>Facilidad para impactar al atacar.</dd>
          <dt>Daño y alcance</dt><dd>El efecto y la distancia del ataque correspondiente.</dd>
        </dl>
      </details>
      <details>
        <summary>Equipo, compras y comparaciones</summary>
        <p>Comprar guarda el artículo en la mochila: no lo equipa automáticamente.
          Abre la ficha de cada personaje para cambiar su equipo.</p>
        <p>Cada clase admite determinados objetos. En la tienda, «Al equiparlo»
          muestra para cada héroe el valor actual → el nuevo y su variación
          en verde (mejora) o rojo (empeora).</p>
        <p>Un arma cuerpo a cuerpo a dos manos sustituye al escudo.
          Los escudos no aportan protección mientras disparas con arco o ballesta.</p>
        <p>Los objetos equipados no se venden. Las pociones y pergaminos
          se usan desde OBJETOS, sin equiparlos.</p>
      </details>
      <details>
        <summary>Exploración y combate</summary>
        <p>Usa las flechas para avanzar, retroceder y girar; Q y E desplazan
          lateralmente durante la exploración. El minimapa muestra tu posición.</p>
        <p>En contacto con enemigos, el combate pasa a turnos. La iniciativa
          determina quién actúa antes. A ataca cuerpo a cuerpo durante tu turno;
          S dispara con un personaje que lleve un arma a distancia válida.
          C abre la magia.</p>
      </details>
      <details>
        <summary>Crónica, progreso y guardado</summary>
        <p>La Crónica reúne encargos, pistas de destino y acontecimientos reales
          de la expedición. El mapa permite orientarte por la región.</p>
        <p>Guarda desde el menú de aventura. «Salir sin guardar» pierde lo
          ocurrido desde el último guardado o cambio de área.</p>
      </details>
    </div>
  );
}
