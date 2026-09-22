import { LGraph, LGraphCanvas, LGraphNode, LiteGraph } from 'litegraph.js';
import type { LightGraphWidget } from './widget';

/**
* Populates an LGraph instance or LightGraphWidget with a set of linked demo nodes.
*/
export function populateDemoNodes(target?: LGraph | LightGraphWidget): void
{
	const graph: LGraph | undefined = target?.constructor.name === 'LightGraphWidget' ? (target as LightGraphWidget)._pooledCanvas?.session?.graph : target as LGraph;
	if(!graph) return;

	graph.clear();

	// 1. Create Nodes
	const constNodeA = LiteGraph.createNode('basic/const');
	if(constNodeA)
	{
		constNodeA.pos = [100, 150];
		//constNodeA.setValue(10);
		graph.add(constNodeA);
	}

	const constNodeB = LiteGraph.createNode('basic/const');
	if(constNodeB)
	{
		constNodeB.pos = [100, 280];
		//constNodeB.setValue(25);
		graph.add(constNodeB);
	}

	const addNode = LiteGraph.createNode('math/add');
	if(addNode)
	{
		addNode.pos = [350, 200];
		graph.add(addNode);
	}

	const watchNode = LiteGraph.createNode('basic/watch');
	if(watchNode)
	{
		watchNode.pos = [600, 200];
		graph.add(watchNode);
	}

	const buttonNode = LiteGraph.createNode('widget/button');
	if(buttonNode)
	{
		buttonNode.pos = [100, 400];
		buttonNode.title = 'Reset Demo';
		graph.add(buttonNode);
	}

	// 2. Connect Node Slots (outSlot, targetNode, inSlot)
	if(constNodeA && addNode)
	{
		constNodeA.connect(0, addNode, 0);
	}
	if(constNodeB && addNode)
	{
		constNodeB.connect(0, addNode, 1);
	}
	if(addNode && watchNode)
	{
		addNode.connect(0, watchNode, 0);
	}

	// 3. Start Execution Cycle
	graph.start();
}
