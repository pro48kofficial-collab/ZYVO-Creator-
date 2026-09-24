import * as THREE from "three";

import {
  OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
  TransformControls
} from "three/addons/controls/TransformControls.js";

import {
  GLTFLoader
} from "three/addons/loaders/GLTFLoader.js";


const $ = id =>
  document.getElementById(id);


const viewport =
  $("viewport");


let scene;
let camera;
let renderer;

let orbit;
let transform;
let grid;

let selected = null;

let objects = [];


function status(text) {
  $("status").textContent =
    text;
}


function resize() {

  if (!renderer)
    return;

  camera.aspect =
    viewport.clientWidth /
    viewport.clientHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    viewport.clientWidth,
    viewport.clientHeight
  );
}


function animate() {

  requestAnimationFrame(
    animate
  );

  orbit.update();

  renderer.render(
    scene,
    camera
  );
}


function init() {

  scene =
    new THREE.Scene();

  scene.background =
    new THREE.Color(
      0xdfe8ef
    );


  camera =
    new THREE.PerspectiveCamera(
      60,
      1,
      0.1,
      2000
    );

  camera.position.set(
    8,
    7,
    10
  );


  renderer =
    new THREE.WebGLRenderer({
      antialias: true
    });

  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      2
    )
  );

  renderer.setSize(
    viewport.clientWidth,
    viewport.clientHeight
  );

  viewport.appendChild(
    renderer.domElement
  );


  orbit =
    new OrbitControls(
      camera,
      renderer.domElement
    );

  orbit.enableDamping = true;

  orbit.target.set(
    0,
    1,
    0
  );


  transform =
    new TransformControls(
      camera,
      renderer.domElement
    );

  transform.setMode(
    "translate"
  );

  transform.addEventListener(
    "dragging-changed",
    event => {
      orbit.enabled =
        !event.value;
    }
  );

  scene.add(
    transform
  );


  scene.add(
    new THREE.HemisphereLight(
      0xffffff,
      0x667788,
      2
    )
  );


  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      3
    );

  sun.position.set(
    6,
    12,
    8
  );

  sun.castShadow = true;

  scene.add(sun);


  grid =
    new THREE.GridHelper(
      40,
      40,
      0x777777,
      0xbbbbbb
    );

  scene.add(grid);


  addPrimitive(
    "box"
  );


  window.addEventListener(
    "resize",
    resize
  );


  renderer.domElement
    .addEventListener(
      "pointerdown",
      pick
    );


  document
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          addPrimitive(
            button.dataset.add
          );

    });


  document
    .querySelectorAll(
      "[data-tool]"
    )
    .forEach(button => {

      button.onclick = () => {

        transform.setMode(
          button.dataset.tool
        );

        status(
          "Інструмент: " +
          button.dataset.tool
        );

      };

    });


  $("gridToggle").onchange =
    event => {

      grid.visible =
        event.target.checked;

    };


  $("snapToggle").onchange =
    event => {

      if (event.target.checked) {

        transform.setTranslationSnap(
          0.5
        );

        transform.setRotationSnap(
          THREE.MathUtils.degToRad(
            15
          )
        );

        transform.setScaleSnap(
          0.25
        );

      } else {

        transform.setTranslationSnap(
          null
        );

        transform.setRotationSnap(
          null
        );

        transform.setScaleSnap(
          null
        );

      }

    };


  $("deleteBtn").onclick =
    deleteSelected;


  $("duplicateBtn").onclick =
    duplicateSelected;


  $("textureBtn").onclick =
    () =>
      $("textureInput").click();


  $("textureInput").onchange =
    event => {

      const file =
        event.target.files[0];

      if (file)
        applyTexture(file);

    };


  $("newBtn").onclick =
    newProject;


  $("saveBtn").onclick =
    exportZYVO;


  $("openBtn").onclick =
    () =>
      $("fileInput").click();


  $("fileInput").onchange =
    importFile;


  $("publishBtn").onclick =
    saveToServer;


  bindProperties();

  animate();

  resize();
}


function addPrimitive(
  kind,
  silent = false
) {

  let geometry;


  if (kind === "sphere") {

    geometry =
      new THREE.SphereGeometry(
        1,
        32,
        20
      );

  } else if (
    kind === "cylinder"
  ) {

    geometry =
      new THREE.CylinderGeometry(
        1,
        1,
        2,
        32
      );

  } else if (
    kind === "plane"
  ) {

    geometry =
      new THREE.BoxGeometry(
        5,
        0.2,
        5
      );

  } else {

    geometry =
      new THREE.BoxGeometry(
        2,
        2,
        2
      );

  }


  const material =
    new THREE.MeshStandardMaterial({
      color: 0x7cff00,
      roughness: 0.65
    });


  const object =
    new THREE.Mesh(
      geometry,
      material
    );


  object.name =
    kind[0].toUpperCase() +
    kind.slice(1) +
    "_" +
    (objects.length + 1);


  object.position.y =
    kind === "plane"
      ? 0
      : 1;


  object.userData.zyvo = {

    id:
      crypto.randomUUID(),

    kind,

    texture: null

  };


  object.castShadow =
    true;

  object.receiveShadow =
    true;


  scene.add(object);

  objects.push(object);

  select(object);

  list();


  if (!silent) {

    status(
      "Створено " +
      object.name
    );

  }

}


function select(object) {

  selected =
    object;

  transform.attach(
    object
  );


  $("noSelection")
    .classList
    .add("hidden");


  $("propertyForm")
    .classList
    .remove("hidden");


  refresh();

  list();
}


function refresh() {

  if (!selected)
    return;


  $("objName").value =
    selected.name;


  $("objColor").value =
    "#" +
    selected.material
      .color
      .getHexString();


  $("objOpacity").value =
    selected.material.opacity;


  ["x", "y", "z"]
    .forEach(axis => {

      $("p" + axis).value =
        selected.position[
          axis
        ].toFixed(2);


      $("r" + axis).value =
        THREE.MathUtils
          .radToDeg(
            selected.rotation[
              axis
            ]
          )
          .toFixed(1);


      $("s" + axis).value =
        selected.scale[
          axis
        ].toFixed(2);

    });

}


function list() {

  $("objectList")
    .innerHTML = "";


  objects.forEach(
    object => {

      const div =
        document.createElement(
          "div"
        );

      div.className =
        "object-item" +
        (
          object === selected
            ? " selected"
            : ""
        );


      div.textContent =
        "▣ " +
        object.name;


      div.onclick =
        () =>
          select(object);


      $("objectList")
        .appendChild(div);

    }
  );


  $("objectCount")
    .textContent =
    objects.length +
    " об'єктів";
}


function pick(event) {

  if (
    event.button !== 0
  )
    return;


  const rect =
    renderer.domElement
      .getBoundingClientRect();


  const point =
    new THREE.Vector2(

      (
        (event.clientX -
          rect.left) /
        rect.width
      ) * 2 - 1,

      -(
        (event.clientY -
          rect.top) /
        rect.height
      ) * 2 + 1

    );


  const raycaster =
    new THREE.Raycaster();


  raycaster.setFromCamera(
    point,
    camera
  );


  const hits =
    raycaster.intersectObjects(
      objects,
      true
    );


  if (!hits.length)
    return;


  let object =
    hits[0].object;


  while (
    object.parent &&
    !objects.includes(object)
  ) {

    object =
      object.parent;

  }


  if (
    objects.includes(object)
  ) {

    select(object);

  }

}


function bindProperties() {

  $("objName").oninput =
    event => {

      if (!selected)
        return;

      selected.name =
        event.target.value ||
        "Object";

      list();

    };


  $("objColor").oninput =
    event => {

      if (selected) {

        selected.material
          .color
          .set(
            event.target.value
          );

      }

    };


  $("objOpacity").oninput =
    event => {

      if (!selected)
        return;

      selected.material
        .opacity =
        +event.target.value;


      selected.material
        .transparent =
        selected.material.opacity < 1;

    };


  ["x", "y", "z"]
    .forEach(axis => {

      $("p" + axis)
        .onchange =
        event => {

          if (selected) {

            selected.position[
              axis
            ] =
              +event.target.value ||
              0;

          }

        };


      $("r" + axis)
        .onchange =
        event => {

          if (selected) {

            selected.rotation[
              axis
            ] =
              THREE.MathUtils
                .degToRad(
                  +event.target.value ||
                  0
                );

          }

        };


      $("s" + axis)
        .onchange =
        event => {

          if (selected) {

            selected.scale[
              axis
            ] =
              Math.max(
                0.01,
                +event.target.value ||
                1
              );

          }

        };

    });

}


function deleteSelected() {

  if (!selected)
    return;


  scene.remove(
    selected
  );


  objects =
    objects.filter(
      object =>
        object !== selected
    );


  selected = null;

  transform.detach();


  $("propertyForm")
    .classList
    .add("hidden");


  $("noSelection")
    .classList
    .remove("hidden");


  list();

  status(
    "Об'єкт видалено"
  );

}


function duplicateSelected() {

  if (!selected)
    return;


  const copy =
    selected.clone();


  copy.name =
    selected.name +
    "_Copy";


  copy.position.x += 1;


  copy.userData.zyvo = {

    ...(selected.userData.zyvo || {}),

    id:
      crypto.randomUUID()

  };


  scene.add(copy);

  objects.push(copy);

  select(copy);

  list();

}


function applyTexture(file) {

  if (!selected)
    return;


  const reader =
    new FileReader();


  reader.onload = () => {

    new THREE.TextureLoader()
      .load(
        reader.result,
        texture => {

          texture.colorSpace =
            THREE.SRGBColorSpace;


          selected.material.map =
            texture;


          selected.material
            .needsUpdate = true;


          selected.userData
            .zyvo
            .texture =
            reader.result;


          status(
            "Текстуру застосовано"
          );

        }
      );

  };


  reader.readAsDataURL(
    file
  );

}


function serialize(object) {

  return {

    id:
      object.userData
        .zyvo?.id ||
      crypto.randomUUID(),

    name:
      object.name,

    kind:
      object.userData
        .zyvo?.kind ||
      "box",

    position:
      object.position.toArray(),

    rotation: [

      object.rotation.x,
      object.rotation.y,
      object.rotation.z

    ],

    scale:
      object.scale.toArray(),

    color:
      "#" +
      object.material
        .color
        .getHexString(),

    opacity:
      object.material.opacity,

    texture:
      object.userData
        .zyvo?.texture ||
      null

  };

}


function projectData() {

  return {

    zyvoVersion: 1,

    format: "ZYVO",

    name:
      $("projectName")
        .value
        .trim() ||
      "MyWorld",

    createdBy:
      "ZYVO Creator 3D",

    objects:
      objects.map(
        serialize
      )

  };

}


function download(
  name,
  text
) {

  const link =
    document.createElement(
      "a"
    );


  link.href =
    URL.createObjectURL(
      new Blob(
        [text],
        {
          type:
            "application/octet-stream"
        }
      )
    );


  link.download =
    name;


  link.click();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        link.href
      ),
    500
  );

}


function exportZYVO() {

  const data =
    projectData();


  download(
    (
      data.name ||
      "MyWorld"
    ) + ".zyvo",

    JSON.stringify(
      data,
      null,
      2
    )
  );


  status(
    "Експортовано .zyvo"
  );

}


function newProject() {

  objects.forEach(
    object =>
      scene.remove(
        object
      )
  );


  objects = [];

  selected = null;

  transform.detach();


  $("projectName")
    .value =
    "MyWorld";


  $("propertyForm")
    .classList
    .add("hidden");


  $("noSelection")
    .classList
    .remove("hidden");


  addPrimitive(
    "box",
    true
  );


  status(
    "Новий проєкт"
  );

}


async function saveToServer() {

  try {

    const response =
      await fetch(
        "/api/projects",
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              projectData()
            )

        }
      );


    const data =
      await response.json();


    if (!response.ok)
      throw new Error(
        data.error
      );


    status(
      "Збережено: " +
      data.file
    );


  } catch (error) {

    console.error(error);

    status(
      "Помилка збереження"
    );

  }

}


async function importFile(
  event
) {

  const file =
    event.target.files[0];


  if (!file)
    return;


  try {

    if (
      file.name
        .toLowerCase()
        .endsWith(".zyvo")
    ) {

      loadZYVO(
        JSON.parse(
          await file.text()
        )
      );

    } else if (
      file.name
        .toLowerCase()
        .endsWith(".glb")
    ) {

      await importGLB(
        file
      );

    } else {

      throw new Error(
        "Підтримуються .zyvo і .glb"
      );

    }


    status(
      "Імпортовано " +
      file.name
    );


  } catch (error) {

    console.error(error);

    alert(
      "Не вдалося імпортувати файл."
    );

  }


  event.target.value = "";

}


function geometry(kind) {

  if (
    kind === "sphere"
  ) {

    return new THREE.SphereGeometry(
      1,
      32,
      20
    );

  }


  if (
    kind === "cylinder"
  ) {

    return new THREE.CylinderGeometry(
      1,
      1,
      2,
      32
    );

  }


  if (
    kind === "plane"
  ) {

    return new THREE.BoxGeometry(
      5,
      0.2,
      5
    );

  }


  return new THREE.BoxGeometry(
    2,
    2,
    2
  );

}


function loadZYVO(data) {

  if (
    data.format !== "ZYVO"
  ) {

    throw new Error(
      "Не ZYVO"
    );

  }


  objects.forEach(
    object =>
      scene.remove(
        object
      )
  );


  objects = [];

  selected = null;

  transform.detach();


  $("projectName")
    .value =
    data.name ||
    "ImportedWorld";


  (
    data.objects ||
    []
  ).forEach(item => {

    const object =
      new THREE.Mesh(

        geometry(
          item.kind
        ),

        new THREE.MeshStandardMaterial({

          color:
            item.color ||
            "#7cff00",

          opacity:
            item.opacity ??
            1,

          transparent:
            (item.opacity ??
              1) < 1,

          roughness:
            0.65

        })

      );


    object.name =
      item.name ||
      "Object";


    object.position.fromArray(
      item.position ||
      [0, 0, 0]
    );


    object.rotation.set(
      ...(item.rotation ||
        [0, 0, 0])
    );


    object.scale.fromArray(
      item.scale ||
      [1, 1, 1]
    );


    object.userData.zyvo = {

      id:
        item.id ||
        crypto.randomUUID(),

      kind:
        item.kind ||
        "box",

      texture:
        item.texture ||
        null

    };


    if (item.texture) {

      new THREE.TextureLoader()
        .load(
          item.texture,
          texture => {

            texture.colorSpace =
              THREE.SRGBColorSpace;

            object.material.map =
              texture;

            object.material
              .needsUpdate = true;

          }
        );

    }


    scene.add(
      object
    );

    objects.push(
      object
    );

  });


  list();

}


async function importGLB(
  file
) {

  const loader =
    new GLTFLoader();


  const buffer =
    await file.arrayBuffer();


  const gltf =
    await new Promise(
      (resolve, reject) => {

        loader.parse(
          buffer,
          "",
          resolve,
          reject
        );

      }
    );


  objects.forEach(
    object =>
      scene.remove(
        object
      )
  );


  objects = [];

  selected = null;

  transform.detach();


  const root =
    gltf.scene;


  root.name =
    file.name.replace(
      /\.glb$/i,
      ""
    );


  root.userData.zyvo = {

    id:
      crypto.randomUUID(),

    kind:
      "imported"

  };


  scene.add(
    root
  );


  objects.push(
    root
  );


  select(root);

  list();

}


init();
