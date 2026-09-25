let state = {
  objects: [],
  selected: null,
  playing: false,
  firstPerson: false,
  player: null,
  velocityY: 0,
  onGround: false,
  keys: {}
};

let scene;
let camera;
let renderer;
let world;
let raycaster;
let mouse;
let clock;
let socket;


function boot() {

  scene = new THREE.Scene();

  scene.background =
    new THREE.Color(0xcfd3d7);


  camera =
    new THREE.PerspectiveCamera(
      70,
      1,
      .1,
      1000
    );

  camera.position.set(
    8,
    8,
    12
  );


  renderer =
    new THREE.WebGLRenderer({
      antialias: true
    });

  renderer.setPixelRatio(
    Math.min(devicePixelRatio, 2)
  );

  renderer.shadowMap.enabled = true;


  document
    .getElementById("scene")
    .appendChild(renderer.domElement);


  const ambient =
    new THREE.HemisphereLight(
      0xffffff,
      0x777777,
      2
    );

  scene.add(ambient);


  const sun =
    new THREE.DirectionalLight(
      0xffffff,
      2
    );

  sun.position.set(
    10,
    20,
    10
  );

  sun.castShadow = true;

  scene.add(sun);


  world =
    new THREE.Group();

  scene.add(world);


  const ground =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        40,
        .5,
        40
      ),
      new THREE.MeshStandardMaterial({
        color: 0xeeeeee
      })
    );

  ground.position.y = -.25;

  ground.receiveShadow = true;

  world.add(ground);


  raycaster =
    new THREE.Raycaster();

  mouse =
    new THREE.Vector2();

  clock =
    new THREE.Clock();


  window.addEventListener(
    "resize",
    resize
  );


  resize();


  renderer.domElement
    .addEventListener(
      "pointerdown",
      pick
    );


  window.addEventListener(
    "keydown",
    event => {

      state.keys[event.code] = true;

      if (event.code === "Space") {
        jump();
      }

    }
  );


  window.addEventListener(
    "keyup",
    event => {
      state.keys[event.code] = false;
    }
  );


  document
    .querySelectorAll("[data-add]")
    .forEach(button => {

      button.onclick = () => {
        addObject(
          button.dataset.add
        );
      };

    });


  document
    .getElementById("saveBtn")
    .onclick = saveProject;


  document
    .getElementById("exportBtn")
    .onclick = exportZyvo;


  document
    .getElementById("glbBtn")
    .onclick = exportGLB;


  document
    .getElementById("importBtn")
    .onclick = () => {
      fileInput.click();
    };


  fileInput.onchange =
    importFile;


  document
    .getElementById("playBtn")
    .onclick = togglePlay;


  document
    .getElementById("publishBtn")
    .onclick = () => {
      publishDialog.showModal();
    };


  document
    .getElementById("confirmPublish")
    .onclick = publish;


  document
    .getElementById("deleteBtn")
    .onclick = deleteSelected;


  document
    .getElementById("viewBtn")
    .onclick = () => {
      state.firstPerson =
        !state.firstPerson;
    };


  [
    "objName",
    "px",
    "py",
    "pz",
    "scale"
  ].forEach(id => {

    document
      .getElementById(id)
      .addEventListener(
        "input",
        updateSelected
      );

  });


  document
    .getElementById("texture")
    .addEventListener(
      "change",
      applyTexture
    );


  if (innerWidth < 700) {
    document.body.classList.add(
      "mobile"
    );
  }


  try {

    socket = io();

    socket.on(
      "connect",
      () => {
        console.log(
          "Multiplayer connected"
        );
      }
    );

  } catch (error) {
    console.log(error);
  }


  const backup =
    localStorage.getItem(
      "zyvo_project"
    );


  if (backup) {

    try {
      loadData(
        JSON.parse(backup)
      );
    } catch {}

  }


  animate();


  setTimeout(() => {

    document
      .getElementById("loadFill")
      .style.width = "100%";

    setTimeout(() => {

      document
        .getElementById("loading")
        .remove();

    }, 250);

  }, 300);
}


function resize() {

  const el =
    document.getElementById("scene");


  renderer.setSize(
    el.clientWidth,
    el.clientHeight,
    false
  );


  camera.aspect =
    el.clientWidth /
    el.clientHeight;


  camera.updateProjectionMatrix();
}


function createMaterial(color) {

  return new THREE.MeshStandardMaterial({
    color
  });

}


function createGeometry(type) {

  if (type === "sphere") {

    return new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        24,
        16
      ),
      createMaterial(0xaaaaaa)
    );

  }


  if (type === "cylinder") {

    return new THREE.Mesh(
      new THREE.CylinderGeometry(
        1,
        1,
        2,
        20
      ),
      createMaterial(0xaaaaaa)
    );

  }


  if (type === "tree") {

    const group =
      new THREE.Group();


    const trunk =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          .25,
          .35,
          3,
          10
        ),
        createMaterial(0x754c24)
      );


    trunk.position.y = 1.5;


    const leaves =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          1.5,
          16,
          12
        ),
        createMaterial(0x329447)
      );


    leaves.position.y = 3.3;


    group.add(
      trunk,
      leaves
    );


    return group;
  }


  if (type === "table") {

    const group =
      new THREE.Group();


    const top =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          3,
          .3,
          2
        ),
        createMaterial(0x9a6b3a)
      );


    top.position.y = 2;


    group.add(top);


    for (
      const x of [-1.2, 1.2]
    ) {

      for (
        const z of [-.7, .7]
      ) {

        const leg =
          new THREE.Mesh(
            new THREE.BoxGeometry(
              .25,
              2,
              .25
            ),
            createMaterial(0x754c24)
          );


        leg.position.set(
          x,
          1,
          z
        );


        group.add(leg);

      }

    }


    return group;
  }


  if (type === "chair") {

    const group =
      new THREE.Group();


    const seat =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2,
          .25,
          2
        ),
        createMaterial(0x9a6b3a)
      );


    seat.position.y = 1;


    const back =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2,
          2,
          .25
        ),
        createMaterial(0x754c24)
      );


    back.position.set(
      0,
      2,
      -.85
    );


    group.add(
      seat,
      back
    );


    return group;
  }


  if (type === "car") {

    const group =
      new THREE.Group();


    const body =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          4,
          1,
          2
        ),
        createMaterial(0xd33d3d)
      );


    body.position.y = 1;


    group.add(body);


    return group;
  }


  if (type === "plane") {

    const group =
      new THREE.Group();


    const body =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          4,
          .4,
          1
        ),
        createMaterial(0xdddddd)
      );


    body.position.y = 1;


    const wings =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          1,
          .15,
          5
        ),
        createMaterial(0xdddddd)
      );


    wings.position.y = 1;


    group.add(
      body,
      wings
    );


    return group;
  }


  if (type === "weapon") {

    const group =
      new THREE.Group();


    const weapon =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          .4,
          .5,
          2
        ),
        createMaterial(0x333333)
      );


    group.add(weapon);


    return group;
  }


  if (type === "spawn") {

    const spawn =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          1,
          .8,
          .2,
          24
        ),
        createMaterial(0x18a957)
      );


    return spawn;
  }


  return new THREE.Mesh(
    new THREE.BoxGeometry(
      2,
      2,
      2
    ),
    createMaterial(0xaaaaaa)
  );

}


function addObject(
  type,
  x = 0,
  y = 1,
  z = 0
) {

  const mesh =
    createGeometry(type);


  mesh.userData = {

    id: crypto.randomUUID(),

    type,

    name: type

  };


  mesh.position.set(
    x,
    y,
    z
  );


  mesh.castShadow = true;


  world.add(mesh);


  state.objects.push(mesh);


  select(mesh);
}


function select(object) {

  state.selected =
    object;


  document
    .getElementById(
      "emptyInspector"
    )
    .hidden = true;


  document
    .getElementById(
      "inspector"
    )
    .hidden = false;


  objName.value =
    object.userData.name;


  px.value =
    object.position.x;


  py.value =
    object.position.y;


  pz.value =
    object.position.z;


  scale.value =
    object.scale.x;
}


function pick(event) {

  if (state.playing) {
    return;
  }


  const rect =
    renderer.domElement
      .getBoundingClientRect();


  mouse.x =
    (
      (event.clientX -
        rect.left) /
      rect.width
    ) * 2 - 1;


  mouse.y =
    -(
      (event.clientY -
        rect.top) /
      rect.height
    ) * 2 + 1;


  raycaster
    .setFromCamera(
      mouse,
      camera
    );


  const hits =
    raycaster.intersectObjects(
      world.children,
      true
    );


  if (!hits.length) {
    return;
  }


  let object =
    hits[0].object;


  while (
    object.parent !== world &&
    object.parent
  ) {

    object =
      object.parent;

  }


  select(object);
}


function updateSelected() {

  if (!state.selected) {
    return;
  }


  state.selected.userData.name =
    objName.value;


  state.selected.position.set(
    Number(px.value) || 0,
    Number(py.value) || 0,
    Number(pz.value) || 0
  );


  const s =
    Math.max(
      .1,
      Number(scale.value) || 1
    );


  state.selected.scale.setScalar(
    s
  );
}


function deleteSelected() {

  if (!state.selected) {
    return;
  }


  world.remove(
    state.selected
  );


  state.objects =
    state.objects.filter(
      object =>
        object !== state.selected
    );


  state.selected = null;


  document
    .getElementById(
      "inspector"
    )
    .hidden = true;


  document
    .getElementById(
      "emptyInspector"
    )
    .hidden = false;
}


function applyTexture(event) {

  if (
    !state.selected ||
    !event.target.files[0]
  ) {
    return;
  }


  const url =
    URL.createObjectURL(
      event.target.files[0]
    );


  new THREE.TextureLoader()
    .load(url, texture => {

      texture.colorSpace =
        THREE.SRGBColorSpace;


      state.selected.traverse(
        object => {

          if (!object.isMesh) {
            return;
          }


          object.material.map =
            texture;


          object.material.needsUpdate =
            true;

        }
      );

    });
}


function projectData() {

  return {

    version: 1,

    objects:
      state.objects.map(
        object => ({

          type:
            object.userData.type,

          name:
            object.userData.name,

          position:
            object.position.toArray(),

          scale:
            object.scale.toArray()

        })
      )

  };
}


function saveProject() {

  const data =
    projectData();


  localStorage.setItem(
    "zyvo_project",
    JSON.stringify(data)
  );


  fetch(
    "/api/projects",
    {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          project: data
        })

    }
  ).catch(() => {});


  alert(
    "💾 Проєкт збережено"
  );
}


function loadData(data) {

  state.objects.forEach(
    object =>
      world.remove(object)
  );


  state.objects = [];


  (data.objects || [])
    .forEach(object => {

      const mesh =
        createGeometry(
          object.type
        );


      mesh.userData = {

        type:
          object.type,

        name:
          object.name ||
          object.type,

        id:
          crypto.randomUUID()

      };


      mesh.position.fromArray(
        object.position ||
        [0, 1, 0]
      );


      if (object.scale) {

        mesh.scale.fromArray(
          object.scale
        );

      }


      world.add(mesh);

      state.objects.push(mesh);

    });
}


function exportZyvo() {

  const blob =
    new Blob(
      [
        JSON.stringify(
          projectData(),
          null,
          2
        )
      ],
      {
        type:
          "application/json"
      }
    );


  download(
    blob,
    "project.zyvo"
  );
}


function importFile(event) {

  const file =
    event.target.files[0];


  if (!file) {
    return;
  }


  if (
    file.name.endsWith(".zyvo")
  ) {

    const reader =
      new FileReader();


    reader.onload = () => {

      try {

        const data =
          JSON.parse(
            reader.result
          );


        loadData(data);


        localStorage.setItem(
          "zyvo_project",
          reader.result
        );

      } catch {

        alert(
          "Невірний .zyvo файл"
        );

      }

    };


    reader.readAsText(file);


    return;
  }


  if (
    file.name.endsWith(".glb")
  ) {

    const reader =
      new FileReader();


    reader.onload = () => {

      const loader =
        new THREE.GLTFLoader();


      loader.parse(
        reader.result,
        "",

        gltf => {

          gltf.scene.position.y =
            1;


          world.add(
            gltf.scene
          );


          state.objects.push(
            gltf.scene
          );

        },

        () => {},

        () => {

          alert(
            "Не вдалося імпортувати GLB"
          );

        }
      );

    };


    reader.readAsArrayBuffer(
      file
    );
  }
}


function exportGLB() {

  const exporter =
    new THREE.GLTFExporter();


  exporter.parse(
    world,

    result => {

      const blob =
        new Blob(
          [result],
          {
            type:
              "model/gltf-binary"
          }
        );


      download(
        blob,
        "project.glb"
      );

    },

    {
      binary: true
    }
  );
}


function download(
  blob,
  filename
) {

  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      "a"
    );


  a.href = url;

  a.download = filename;

  a.click();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}


function togglePlay() {

  state.playing =
    !state.playing;


  document
    .getElementById(
      "playBtn"
    )
    .textContent =
    state.playing
      ? "⏹ Редактор"
      : "▶ Грати";


  document
    .getElementById(
      "crosshair"
    )
    .style.display =
    state.playing
      ? "block"
      : "none";


  if (!state.playing) {
    return;
  }


  const spawn =
    state.objects.find(
      object =>
        object.userData.type ===
        "spawn"
    );


  state.player = {

    position:
      spawn
        ? spawn.position.clone()
        : new THREE.Vector3(
            0,
            1,
            0
          )

  };


  camera.position.copy(
    state.player.position
  );


  camera.position.y += 5;

  camera.position.z += 8;
}


function jump() {

  if (
    state.playing &&
    state.onGround
  ) {

    state.velocityY = 7;

    state.onGround = false;

  }
}


function gameLoop(dt) {

  if (
    !state.playing ||
    !state.player
  ) {
    return;
  }


  const movement =
    new THREE.Vector3();


  if (state.keys.KeyW)
    movement.z -= 1;

  if (state.keys.KeyS)
    movement.z += 1;

  if (state.keys.KeyA)
    movement.x -= 1;

  if (state.keys.KeyD)
    movement.x += 1;


  if (movement.length()) {

    movement
      .normalize()
      .multiplyScalar(
        7 * dt
      );


    state.player.position.add(
      movement
    );

  }


  state.velocityY -=
    18 * dt;


  state.player.position.y +=
    state.velocityY * dt;


  if (
    state.player.position.y <= 1
  ) {

    state.player.position.y = 1;

    state.velocityY = 0;

    state.onGround = true;

  }


  if (
    state.player.position.y <
    -10
  ) {

    const spawn =
      state.objects.find(
        object =>
          object.userData.type ===
          "spawn"
      );


    state.player.position.copy(
      spawn
        ? spawn.position
        : new THREE.Vector3(
            0,
            1,
            0
          )
    );

  }


  const target =
    state.player.position.clone();


  if (state.firstPerson) {

    camera.position.copy(
      target
    );

    camera.position.y +=
      1.5;

  } else {

    camera.position.lerp(
      target.clone().add(
        new THREE.Vector3(
          0,
          5,
          8
        )
      ),
      .15
    );

  }


  camera.lookAt(
    target
  );
}


function animate() {

  requestAnimationFrame(
    animate
  );


  const dt =
    Math.min(
      clock.getDelta(),
      .05
    );


  gameLoop(dt);


  renderer.render(
    scene,
    camera
  );
}


async function publish(event) {

  event.preventDefault();


  const title =
    document
      .getElementById(
        "gameTitle"
      )
      .value
      .trim();


  if (!title) {
    return;
  }


  const data = {

    title,

    description:
      document
        .getElementById(
          "gameDescription"
        )
        .value,

    multiplayer:
      document
        .getElementById(
          "multiplayer"
        )
        .checked,

    project:
      projectData()

  };


  try {

    const response =
      await fetch(
        "/api/publish",
        {

          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(data)

        }
      );


    if (!response.ok) {
      throw new Error();
    }


    alert(
      "🚀 Гру опубліковано на ZYVO Platform"
    );


    publishDialog.close();


  } catch {

    alert(
      "❌ Не вдалося опублікувати. Перевір PLATFORM_URL."
    );

  }
}


boot();
